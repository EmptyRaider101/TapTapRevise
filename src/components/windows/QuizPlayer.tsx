import { useState, useEffect } from "react"
import { useStore } from "../../store"
import type { Quiz, QuizResult } from "../../store"
import { Button } from "../ui/button"
import { Textarea } from "../ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Badge } from "../ui/badge"
import ReactMarkdown from "react-markdown"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { v4 as uuidv4 } from "uuid"
import {
  HelpCircle,
  Play,
  ArrowLeft,
  Sparkles,
  RefreshCw,
  FileText,
  File,
  CheckSquare,
  Square,
  Hourglass,
  Layers,
} from "lucide-react"

export function QuizPlayer() {
  const { 
    quizzes, 
    files, 
    aiModel, 
    geminiApiKey, 
    saveQuiz, 
    openWindow,
    quizSessions,
    quizResults,
    saveQuizSession,
    deleteQuizSession,
    saveQuizResult
  } = useStore()
  
  // Tabs & Navigation State
  const [activeTab, setActiveTab] = useState("quizzes")
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null)
  
  // Quiz Taker State
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({}) // key: qLocalNumber+qName
  const [isReviewing, setIsReviewing] = useState(false)
  const [scores, setScores] = useState<Record<string, number>>({}) // key: qLocalNumber+qName
  const [isViewOnlyResult, setIsViewOnlyResult] = useState(false)
  
  // Quiz Creator State
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set())
  const [questionsPerFile, setQuestionsPerFile] = useState(10)
  const [model, setModel] = useState<"gemini-3.1-flash-lite-preview" | "gemma-4-31b-it">(aiModel)
  const [quizTitle, setQuizTitle] = useState("New Quiz")
  const [agentStatuses, setAgentStatuses] = useState<Record<string, "waiting" | "running" | "done" | "failed">>({})
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([])

  // Group files by module
  const modules = Array.from(new Set(files.map((f) => f.module || "Uncategorized")))

  // Auto-scroll to currently running files
  useEffect(() => {
    const runningId = Object.keys(agentStatuses).find(id => agentStatuses[id] === "running")
    if (runningId) {
      const el = document.getElementById(`file-row-${runningId}`)
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" })
      }
    }
  }, [agentStatuses])

  // Auto-save quiz session on progress changes
  useEffect(() => {
    if (!activeQuiz || isViewOnlyResult) return
    const saveSession = async () => {
      await saveQuizSession({
        quizId: activeQuiz.id,
        currentQuestionIdx,
        answers,
        isReviewing,
        scores,
        updatedAt: Date.now()
      })
    }
    saveSession()
  }, [answers, currentQuestionIdx, isReviewing, scores, activeQuiz, isViewOnlyResult])

  // -------------------------------------------------------------
  // QUIZ TAKER ACTIONS
  // -------------------------------------------------------------
  const handleStartQuiz = (quiz: Quiz) => {
    const session = quizSessions.find(s => s.quizId === quiz.id)
    if (session) {
      setCurrentQuestionIdx(session.currentQuestionIdx)
      setAnswers(session.answers || {})
      setIsReviewing(session.isReviewing || false)
      setScores(session.scores || {})
    } else {
      setCurrentQuestionIdx(0)
      setAnswers({})
      setIsReviewing(false)
      setScores({})
    }
    setIsViewOnlyResult(false)
    setActiveQuiz(quiz)
  }

  const handleExitQuiz = async (saveProgress: boolean) => {
    if (isViewOnlyResult) {
      setActiveQuiz(null)
      setIsViewOnlyResult(false)
      setIsReviewing(false)
      setAnswers({})
      setScores({})
      return
    }

    if (saveProgress && activeQuiz) {
      await saveQuizSession({
        quizId: activeQuiz.id,
        currentQuestionIdx,
        answers,
        isReviewing,
        scores,
        updatedAt: Date.now()
      })
    } else if (activeQuiz) {
      await deleteQuizSession(activeQuiz.id)
    }
    setActiveQuiz(null)
  }

  const handleViewResult = (result: QuizResult) => {
    const quiz = quizzes.find((q) => q.id === result.quizId)
    if (!quiz) {
      alert("Original quiz questions could not be found.")
      return
    }
    setCurrentQuestionIdx(0)
    setAnswers(result.answers || {})
    setScores(result.scores || {})
    setIsReviewing(true)
    setIsViewOnlyResult(true)
    setActiveQuiz(quiz)
  }

  const handleAnswer = (qKey: string, val: string) => {
    setAnswers((prev) => ({ ...prev, [qKey]: val }))
  }

  const handleFinishQuiz = () => {
    if (!activeQuiz) return
    setIsReviewing(true)
    
    // Auto score multiple choice
    const newScores = { ...scores }
    activeQuiz.questions.forEach((q) => {
      const qKey = q.localNumber + q.name
      if (q.type === "multiple-choice") {
        if (answers[qKey] === q.answer) {
          newScores[qKey] = q.marks
        } else {
          newScores[qKey] = 0
        }
      }
    })
    setScores(newScores)
    setCurrentQuestionIdx(0)
  }

  const handleScoreManual = (qKey: string, marks: number) => {
    setScores((prev) => ({ ...prev, [qKey]: marks }))
  }

  // -------------------------------------------------------------
  // QUIZ CREATOR ACTIONS
  // -------------------------------------------------------------
  const handleToggleFile = (id: string) => {
    const next = new Set(selectedFileIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedFileIds(next)
  }

  const handleToggleModuleFiles = (moduleName: string) => {
    const moduleFiles = files.filter((f) => (f.module || "Uncategorized") === moduleName)
    const allSelected = moduleFiles.every((f) => selectedFileIds.has(f.id))
    const next = new Set(selectedFileIds)
    
    moduleFiles.forEach((f) => {
      if (allSelected) {
        next.delete(f.id)
      } else {
        next.add(f.id)
      }
    })
    setSelectedFileIds(next)
  }

  const handleGenerate = async () => {
    if (!geminiApiKey) {
      alert("Please set your Gemini API Key in Settings first.")
      openWindow("settings")
      return
    }
    
    if (selectedFileIds.size === 0) {
      alert("Please select at least one file.")
      return
    }

    setIsGenerating(true)
    setGeneratedQuestions([])
    
    const fileIdsToProcess = Array.from(selectedFileIds)
    const newStatuses: Record<string, "waiting" | "running" | "done" | "failed"> = {}
    fileIdsToProcess.forEach((id) => (newStatuses[id] = "waiting"))
    setAgentStatuses(newStatuses)

    const BATCH_SIZE = 5
    let currentQuestions: any[] = []
    
    let queue = fileIdsToProcess.map((id) => ({ id, retries: 0 }))
    let lastBatchStartTime = 0

    while (queue.length > 0) {
      const now = Date.now()
      const timeSinceLastBatch = now - lastBatchStartTime
      if (lastBatchStartTime > 0 && timeSinceLastBatch < 21000) {
        const waitTime = 21000 - timeSinceLastBatch
        await new Promise((resolve) => setTimeout(resolve, waitTime))
      }
      lastBatchStartTime = Date.now()

      const batch = queue.splice(0, BATCH_SIZE)
      
      const batchPromises = batch.map(async (task) => {
        const fileId = task.id
        setAgentStatuses((prev) => ({ ...prev, [fileId]: "running" }))
        
        const file = files.find((f) => f.id === fileId)
        if (!file || !file.content) {
          setAgentStatuses((prev) => ({ ...prev, [fileId]: "failed" }))
          return []
        }

        try {
          const genAI = new GoogleGenerativeAI(geminiApiKey)
          const generativeModel = genAI.getGenerativeModel({ model })

          const prompt = `Generate a list of exactly ${questionsPerFile} quiz questions based on the following document content.
The questions should be a mix of multiple choice (2 to 6 options) and free answer.
You MUST return the response as a raw JSON array of objects without any markdown wrappers (e.g. no \`\`\`json).
Do not include any extra text before or after the JSON array.
Use this strict JSON schema for each object:
{
  "name": "Short descriptive name",
  "localNumber": "Q1",
  "topic": "Topic being tested",
  "skills": "Skills being tested",
  "time": 2, // estimated minutes, integer
  "marks": 1, // marks for correct answer, integer
  "question": "The question text, markdown formatted",
  "type": "multiple-choice" or "free-answer",
  "options": ["Option A", "Option B", "Option C", "Option D"], // only include this field if type is multiple-choice
  "answer": "The exact correct option string if multiple-choice, or grading keywords/rubric if free-answer"
}

Document Content:
${file.content.substring(0, 50000)}`

          const result = await generativeModel.generateContent(prompt)
          const responseText = result.response.text()
          
          let parsed: any[] = []
          try {
            let cleaned = responseText.replace(/^```(json)?/, "").replace(/```$/, "").trim()
            parsed = JSON.parse(cleaned)
          } catch (e) {
            console.error("Failed to parse JSON:", e, responseText)
            throw new Error("Invalid JSON")
          }
          
          setAgentStatuses((prev) => ({ ...prev, [fileId]: "done" }))
          return parsed
        } catch (e) {
          console.error("Agent failed for file", fileId, e)
          if (task.retries < 5) {
            setAgentStatuses((prev) => ({ ...prev, [fileId]: "waiting" }))
            queue.push({ id: fileId, retries: task.retries + 1 })
          } else {
            setAgentStatuses((prev) => ({ ...prev, [fileId]: "failed" }))
          }
          return []
        }
      })

      const batchResults = await Promise.all(batchPromises)
      batchResults.forEach((res) => {
        if (res && res.length > 0) {
          currentQuestions = [...currentQuestions, ...res]
        }
      })
      setGeneratedQuestions([...currentQuestions])
    }

    setIsGenerating(false)
  }

  const handleCompile = async () => {
    if (generatedQuestions.length === 0) return
    const quiz: Quiz = {
      id: uuidv4(),
      title: quizTitle,
      questions: generatedQuestions,
      createdAt: Date.now(),
    }
    await saveQuiz(quiz)
    alert("Quiz compiled and added to student's available quizzes!")
    setGeneratedQuestions([])
    setQuizTitle("New Quiz")
    setSelectedFileIds(new Set())
    setAgentStatuses({})
    setActiveTab("quizzes")
  }

  // File Status Badge Helper
  const getFileStatusBadge = (status: string) => {
    switch (status) {
      case "complete":
        return (
          <Badge className="h-4 bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30 text-[9px] px-1 py-0 font-medium">
            Complete
          </Badge>
        )
      case "complete-follow-up":
        return (
          <Badge className="h-4 bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30 text-[9px] px-1 py-0 font-medium">
            Review
          </Badge>
        )
      case "need-to-learn":
        return (
          <Badge className="h-4 bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 text-[9px] px-1 py-0 font-medium">
            Learn
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary" className="h-4 text-[9px] px-1 py-0 text-muted-foreground font-medium">
            Unread
          </Badge>
        )
    }
  }

  // -------------------------------------------------------------
  // ACTIVE QUIZ INTERFACE
  // -------------------------------------------------------------
  if (activeQuiz) {
    const question = activeQuiz.questions[currentQuestionIdx]
    const qKey = question?.localNumber + question?.name
    const totalMarks = activeQuiz.questions.reduce((sum, q) => sum + (q.marks || 0), 0)
    const earnedMarks = Object.values(scores).reduce((sum, val) => sum + val, 0)
    const totalQuestions = activeQuiz.questions.length

    return (
      <div className="flex h-full flex-col bg-background/95 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-muted/30 px-6 py-4">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => handleExitQuiz(true)}
              className="rounded-lg hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-foreground">
                {isViewOnlyResult ? `Viewing Results: ${activeQuiz.title}` : activeQuiz.title}
              </h2>
              <p className="text-[10px] text-muted-foreground">
                {isReviewing ? "Quiz Review & Scoring" : `Question ${currentQuestionIdx + 1} of ${totalQuestions}`}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {(isReviewing || isViewOnlyResult) && (
              <Badge className="h-6 bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30 text-xs font-semibold px-2">
                Score: {earnedMarks} / {totalMarks} Marks
              </Badge>
            )}
            {isViewOnlyResult ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExitQuiz(false)}
                className="h-8 text-xs rounded-lg"
              >
                Close Review
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExitQuiz(true)}
                  className="h-8 text-xs border-primary/20 text-primary hover:bg-primary/5 rounded-lg"
                >
                  Pause & Exit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm("Are you sure you want to reset this quiz? All current answers will be cleared.")) {
                      handleExitQuiz(false)
                    }
                  }}
                  className="h-8 text-xs text-red-500 hover:bg-red-500/10 rounded-lg"
                >
                  Reset & Exit
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="custom-scrollbar flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-3xl space-y-6">
            {/* Question Details Card */}
            <Card className="border bg-card/50 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/10 pb-3 pt-4">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                    {question.localNumber} &bull; {question.topic}
                  </span>
                  <CardTitle className="text-base font-bold mt-0.5">{question.name}</CardTitle>
                </div>
                <div className="flex items-center space-x-1.5 shrink-0">
                  <Badge className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 text-[10px]">
                    {question.marks} Marks
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    <Hourglass className="mr-1 h-3 w-3" /> {question.time} min
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90">
                  <ReactMarkdown>{question.question}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>

            {/* Answer Box */}
            {!isReviewing ? (
              <Card className="border bg-card shadow-sm">
                <CardContent className="pt-6">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-3">
                    Your Response
                  </span>
                  {question.type === "multiple-choice" && question.options ? (
                    <div className="grid gap-2.5">
                      {question.options.map((opt, i) => (
                        <label
                          key={i}
                          className={
                            "flex items-center space-x-3 rounded-xl border p-4 cursor-pointer transition-all " +
                            (answers[qKey] === opt
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border bg-card hover:bg-muted/40")
                          }
                        >
                          <input
                            type="radio"
                            name={qKey}
                            value={opt}
                            disabled={isViewOnlyResult}
                            checked={answers[qKey] === opt}
                            onChange={() => handleAnswer(qKey, opt)}
                            className="h-4 w-4 text-primary border-muted-foreground/30 focus:ring-primary"
                          />
                          <span className="text-sm font-medium text-foreground">{opt}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <Textarea
                      placeholder={isViewOnlyResult ? "No response provided." : "Write your answer details here..."}
                      value={answers[qKey] || ""}
                      disabled={isViewOnlyResult}
                      onChange={(e) => handleAnswer(qKey, e.target.value)}
                      className="min-h-[160px] rounded-xl border-border bg-muted/20 focus-visible:ring-primary resize-y text-sm"
                    />
                  )}
                </CardContent>
              </Card>
            ) : (
              // Review Mode
              <div className="space-y-4">
                <Card className="border bg-card shadow-sm">
                  <CardContent className="pt-6">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                      Your Response
                    </span>
                    <div className="rounded-xl border bg-muted/10 p-4 text-sm text-foreground/90 font-medium">
                      {answers[qKey] ? (
                        answers[qKey]
                      ) : (
                        <span className="italic text-muted-foreground">No answer provided.</span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-green-500/20 bg-green-500/5 shadow-sm">
                  <CardContent className="pt-6">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-green-600 dark:text-green-400 block mb-2">
                      Correct Answer / Grading Rubric
                    </span>
                    <div className="text-sm text-foreground/90 font-medium whitespace-pre-line leading-relaxed">
                      {question.answer}
                    </div>
                  </CardContent>
                </Card>

                {/* Score Panel */}
                <Card className="border bg-card shadow-sm">
                  <CardContent className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold">Assign Marks</h4>
                      <p className="text-xs text-muted-foreground">
                        {question.type === "multiple-choice" 
                          ? "Multiple-choice questions are auto-graded." 
                          : isViewOnlyResult 
                          ? "Marks assigned during review."
                          : "Compare the response against the rubric and award score."}
                      </p>
                    </div>
                    
                    {question.type === "free-answer" ? (
                      isViewOnlyResult ? (
                        <div className="flex items-center gap-2">
                          <Badge className="bg-primary/10 text-primary border border-primary/20 font-bold px-3 py-1">
                            Score: {scores[qKey] !== undefined ? scores[qKey] : 0} / {question.marks} Marks
                          </Badge>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1 bg-muted/30 p-1.5 rounded-xl border">
                          {Array.from({ length: question.marks + 1 }).map((_, i) => (
                            <Button
                              key={i}
                              size="sm"
                              variant={scores[qKey] === i ? "default" : "ghost"}
                              onClick={() => handleScoreManual(qKey, i)}
                              className="h-8 w-8 rounded-lg font-bold text-xs"
                            >
                              {i}
                            </Button>
                          ))}
                        </div>
                      )
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge className={scores[qKey] > 0 ? "bg-green-500/20 text-green-600 border border-green-500/30" : "bg-red-500/20 text-red-600 border border-red-500/30"}>
                          {scores[qKey] !== undefined ? scores[qKey] : 0} / {question.marks} Marks
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="border-t bg-muted/20 px-6 py-4 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={currentQuestionIdx === 0}
            onClick={() => setCurrentQuestionIdx((prev) => prev - 1)}
            className="rounded-lg h-9 px-4 text-xs font-semibold"
          >
            Previous
          </Button>
          
          {currentQuestionIdx < totalQuestions - 1 ? (
            <Button
              onClick={() => setCurrentQuestionIdx((prev) => prev + 1)}
              size="sm"
              className="rounded-lg h-9 px-4 text-xs font-semibold"
            >
              Next Question
            </Button>
          ) : !isReviewing ? (
            <Button
              onClick={handleFinishQuiz}
              variant="default"
              size="sm"
              className="rounded-lg h-9 px-5 text-xs font-bold bg-primary shadow-md hover:bg-primary/95"
            >
              Finish & Grade Quiz
            </Button>
          ) : (
            <Button
              onClick={async () => {
                if (isViewOnlyResult) {
                  handleExitQuiz(false)
                } else {
                  if (activeQuiz) {
                    const totalMarks = activeQuiz.questions.reduce((sum, q) => sum + (q.marks || 0), 0)
                    const earnedMarks = Object.values(scores).reduce((sum, val) => sum + val, 0)
                    const totalQuestions = activeQuiz.questions.length

                    await saveQuizResult({
                      id: uuidv4(),
                      quizId: activeQuiz.id,
                      quizTitle: activeQuiz.title,
                      answers,
                      scores,
                      totalQuestions,
                      totalMarks,
                      earnedMarks,
                      completedAt: Date.now()
                    })

                    await deleteQuizSession(activeQuiz.id)
                  }
                  setActiveQuiz(null)
                }
              }}
              variant="default"
              size="sm"
              className="rounded-lg h-9 px-5 text-xs font-bold shadow-md"
            >
              {isViewOnlyResult ? "Close Review" : "Complete Review"}
            </Button>
          )}
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------
  // DASHBOARD WINDOW (TABS INCLUDED)
  // -------------------------------------------------------------
  return (
    <div className="flex h-full flex-col bg-background/50 overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-1 flex-col">
        {/* Navigation Tabs Bar */}
        <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-2">
          <TabsList className="grid w-[360px] grid-cols-3">
            <TabsTrigger value="quizzes" className="text-xs">Quizzes</TabsTrigger>
            <TabsTrigger value="creator" className="text-xs">Quiz Creator</TabsTrigger>
            <TabsTrigger value="results" className="text-xs">Results</TabsTrigger>
          </TabsList>
          
          {activeTab === "quizzes" && (
            <Button
              onClick={() => setActiveTab("creator")}
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] font-semibold text-primary hover:bg-primary/10"
            >
              + Create Quiz
            </Button>
          )}
        </div>

        {/* QUIZZES TAB CONTENT */}
        <TabsContent value="quizzes" className="m-0 min-h-0 flex-1 overflow-y-auto p-4 data-[state=active]:block">
          {quizzes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="rounded-full bg-primary/10 p-3 text-primary mb-3">
                <HelpCircle className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-sm">No quizzes available</h3>
              <p className="text-xs text-muted-foreground max-w-xs mt-1">
                Generate questions using the Quiz Creator tab based on your uploaded lectures or notes.
              </p>
              <Button
                onClick={() => setActiveTab("creator")}
                variant="outline"
                size="sm"
                className="mt-4 rounded-xl text-xs h-8"
              >
                Go to Quiz Creator
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
              {quizzes.map((quiz) => {
                const session = quizSessions.find((s) => s.quizId === quiz.id)
                const answeredCount = Object.keys(session?.answers || {}).length

                return (
                  <div
                    key={quiz.id}
                    className="group rounded-xl border border-border/85 bg-card p-4 hover:border-border hover:bg-muted/30 transition-all flex flex-col justify-between min-h-[140px] shadow-sm hover:shadow"
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-sm text-foreground/90 tracking-tight leading-snug">
                          {quiz.title}
                        </h3>
                        <div className="flex items-center space-x-1.5">
                          {session && (
                            <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[9px] px-1.5 py-0 font-medium">
                              Paused
                            </Badge>
                          )}
                          <Badge className="bg-primary/10 text-primary border border-primary/20 text-[9px] px-1.5 py-0 font-medium">
                            {quiz.questions.length} Qs
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-[10px] text-muted-foreground">
                          Created: {new Date(quiz.createdAt).toLocaleDateString()}
                        </p>
                        {session && (
                          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                            Progress: {answeredCount}/{quiz.questions.length} Answered
                          </span>
                        )}
                      </div>
                      {session && (
                        <div className="mt-3">
                          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div 
                              className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${(answeredCount / quiz.questions.length) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button
                        onClick={() => handleStartQuiz(quiz)}
                        size="sm"
                        className={`h-8 rounded-lg text-xs font-semibold px-3.5 shadow-none transition-all ${
                          session 
                            ? "bg-amber-500/15 text-amber-600 hover:bg-amber-500 hover:text-white" 
                            : "bg-primary/10 text-primary hover:bg-primary hover:text-white"
                        }`}
                      >
                        {session ? (
                          <>
                            <Play className="mr-1.5 h-3.5 w-3.5 fill-current animate-pulse" /> Resume Quiz
                          </>
                        ) : (
                          <>
                            <Play className="mr-1.5 h-3.5 w-3.5" /> Start Quiz
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* QUIZ CREATOR TAB CONTENT (STYLING MATCHES FILE MANAGER) */}
        <TabsContent value="creator" className="m-0 min-h-0 flex-1 flex flex-col overflow-hidden data-[state=active]:flex">
          {/* Header Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-1.5">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Title:</label>
                <input
                  type="text"
                  value={quizTitle}
                  onChange={(e) => setQuizTitle(e.target.value)}
                  placeholder="Quiz title..."
                  className="h-7 w-44 rounded-lg border border-border/70 bg-card px-2.5 text-[11px] outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                />
              </div>

              <div className="flex items-center space-x-1.5">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Qs/File:</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={questionsPerFile}
                  onChange={(e) => setQuestionsPerFile(Number(e.target.value))}
                  className="h-7 w-12 rounded-lg border border-border/70 bg-card px-2 text-[11px] text-center outline-none focus:border-primary/50"
                />
              </div>

              <div className="flex items-center space-x-1.5">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Model:</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value as any)}
                  className="h-7 rounded-lg border border-border/70 bg-card px-2 text-[11px] text-muted-foreground outline-none focus:ring-0 cursor-pointer"
                >
                  <option value="gemini-3.1-flash-lite-preview">gemini-3.1-flash-lite-preview</option>
                  <option value="gemma-4-31b-it">gemma-4-31b-it</option>
                </select>
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating || selectedFileIds.size === 0}
              size="sm"
              className="h-7.5 rounded-lg text-xs font-bold px-4"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 h-3 w-3" /> Generate Quiz
                </>
              )}
            </Button>
          </div>

          {/* Body Split View */}
          <div className="flex-1 min-h-0 flex overflow-hidden">
            {/* Left Hand Side: File Select List */}
            <div className="w-1/2 border-r flex flex-col overflow-hidden bg-muted/5">
              <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/20 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                <span>Select Files ({selectedFileIds.size} Selected)</span>
                {files.length > 0 && (
                  <button
                    onClick={() => {
                      if (selectedFileIds.size === files.length) {
                        setSelectedFileIds(new Set())
                      } else {
                        setSelectedFileIds(new Set(files.map((f) => f.id)))
                      }
                    }}
                    className="text-primary hover:underline text-[9px] font-bold"
                  >
                    {selectedFileIds.size === files.length ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>
              
              <div className="custom-scrollbar flex-1 overflow-y-auto p-4 space-y-4">
                {files.length === 0 ? (
                  <div className="py-10 text-center text-xs text-muted-foreground italic">
                    No files found in FileManager. Please upload documents first.
                  </div>
                ) : (
                  modules.map((mod) => (
                    <div key={mod} className="space-y-1.5">
                      <div className="flex items-center justify-between pb-1 border-b border-border/50">
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center">
                          <Layers className="mr-1 h-3 w-3" /> {mod}
                        </h4>
                        <button
                          onClick={() => handleToggleModuleFiles(mod)}
                          className="text-[9px] font-bold text-muted-foreground/70 hover:text-primary"
                        >
                          Toggle Module
                        </button>
                      </div>

                      {files
                        .filter((f) => (f.module || "Uncategorized") === mod)
                        .map((file) => {
                          const isSel = selectedFileIds.has(file.id)
                          return (
                            <div
                              key={file.id}
                              id={`file-row-${file.id}`}
                              onClick={() => handleToggleFile(file.id)}
                              className={
                                "group cursor-pointer rounded-lg border p-2.5 transition-all flex items-center justify-between " +
                                (isSel
                                  ? "border-primary bg-primary/5"
                                  : "border-transparent bg-card hover:border-border hover:bg-muted/40")
                              }
                            >
                              <div className="flex items-center space-x-2.5 min-w-0 overflow-hidden">
                                <div className="flex-shrink-0 text-muted-foreground">
                                  {isSel ? (
                                    <CheckSquare className="h-4 w-4 text-primary" />
                                  ) : (
                                    <Square className="h-4 w-4 text-muted-foreground/30" />
                                  )}
                                </div>
                                <div className="flex-shrink-0 rounded-md bg-blue-500/10 p-1.5 text-blue-500">
                                  {file.type.includes("pdf") ? (
                                    <FileText className="h-3.5 w-3.5" />
                                  ) : (
                                    <File className="h-3.5 w-3.5" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <h5 className="truncate text-xs font-semibold text-foreground/90">
                                    {file.name}
                                  </h5>
                                  <div className="mt-0.5 flex items-center gap-1.5">
                                    {getFileStatusBadge(file.status)}
                                  </div>
                                </div>
                              </div>

                              {agentStatuses[file.id] && (
                                <Badge
                                  className={
                                    "h-5 text-[9px] px-1.5 py-0 font-medium " +
                                    (agentStatuses[file.id] === "running"
                                      ? "bg-blue-500/20 text-blue-500 border border-blue-500/30 animate-pulse"
                                      : agentStatuses[file.id] === "done"
                                      ? "bg-green-500/20 text-green-500 border border-green-500/30"
                                      : agentStatuses[file.id] === "failed"
                                      ? "bg-red-500/20 text-red-500 border border-red-500/30"
                                      : "bg-gray-500/20 text-gray-500 border border-gray-500/30")
                                  }
                                >
                                  {agentStatuses[file.id] === "running" && (
                                    <RefreshCw className="mr-1 h-2 w-2 animate-spin" />
                                  )}
                                  {agentStatuses[file.id]}
                                </Badge>
                              )}
                            </div>
                          )
                        })}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Hand Side: Compiled Questions list */}
            <div className="w-1/2 flex flex-col overflow-hidden bg-card/10">
              <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/20 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                <span>Generated Questions ({generatedQuestions.length})</span>
                {generatedQuestions.length > 0 && (
                  <Button
                    onClick={handleCompile}
                    size="sm"
                    className="h-6 rounded-md text-[10px] font-bold bg-green-600 hover:bg-green-700"
                  >
                    Compile & Save
                  </Button>
                )}
              </div>

              <div className="custom-scrollbar flex-1 overflow-y-auto p-4 space-y-3">
                {generatedQuestions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-20 text-center text-muted-foreground">
                    <Sparkles className="h-6 w-6 mb-2 text-muted-foreground/40" />
                    <p className="text-xs font-semibold">No questions generated yet</p>
                    <p className="text-[10px] text-muted-foreground/75 mt-1 max-w-[200px]">
                      Select target documents, set Qs/File and click 'Generate Quiz'.
                    </p>
                  </div>
                ) : (
                  generatedQuestions.map((q, idx) => (
                    <Card key={idx} className="border bg-card/60 shadow-sm overflow-hidden">
                      <div className="flex items-center justify-between border-b bg-muted/25 px-3 py-1.5">
                        <span className="text-[10px] font-bold text-foreground/80">
                          {q.localNumber} &bull; {q.name}
                        </span>
                        <div className="flex gap-1">
                          <Badge variant="outline" className="text-[8px] h-4.5 py-0 px-1 border-primary/20 bg-primary/5 text-primary">
                            {q.marks} Marks
                          </Badge>
                          <Badge variant="secondary" className="text-[8px] h-4.5 py-0 px-1">
                            {q.time} min
                          </Badge>
                        </div>
                      </div>
                      <div className="p-3 text-[11px] space-y-2">
                        <p className="text-muted-foreground italic text-[9px] mb-1">
                          Topic: {q.topic} &bull; Skills: {q.skills}
                        </p>
                        <div className="prose prose-sm dark:prose-invert text-[11.5px] leading-relaxed">
                          <ReactMarkdown>{q.question}</ReactMarkdown>
                        </div>
                        {q.type === "multiple-choice" && q.options && (
                          <div className="pl-3 border-l-2 border-primary/20 space-y-0.5 text-muted-foreground text-[10.5px]">
                            {q.options.map((opt: string, i: number) => (
                              <div key={i}>&bull; {opt}</div>
                            ))}
                          </div>
                        )}
                        <p className="text-green-600 dark:text-green-400 font-bold text-[10px] pt-1">
                          Ans: {q.answer}
                        </p>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* RESULTS TAB CONTENT */}
        <TabsContent value="results" className="m-0 min-h-0 flex-1 overflow-y-auto p-4 data-[state=active]:block">
          {quizResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="rounded-full bg-primary/10 p-3 text-primary mb-3">
                <CheckSquare className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-sm">No results recorded yet</h3>
              <p className="text-xs text-muted-foreground max-w-xs mt-1">
                Complete a quiz and finish your review to see your score history and details here.
              </p>
            </div>
          ) : (
            <div className="space-y-3 mx-auto max-w-3xl">
              {quizResults.map((result) => {
                const percent = Math.round((result.earnedMarks / (result.totalMarks || 1)) * 100)
                let badgeColor = "bg-red-500/10 text-red-600 border-red-500/20"
                if (percent >= 75) {
                  badgeColor = "bg-green-500/10 text-green-600 border-green-500/20"
                } else if (percent >= 50) {
                  badgeColor = "bg-amber-500/10 text-amber-600 border-amber-500/20"
                }
                
                return (
                  <div
                    key={result.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl border border-border/80 bg-card hover:bg-muted/10 transition-all gap-4 shadow-sm"
                  >
                    <div className="space-y-1">
                      <h4 className="font-bold text-sm text-foreground/90 tracking-tight leading-snug">
                        {result.quizTitle}
                      </h4>
                      <p className="text-[10px] text-muted-foreground">
                        Completed: {new Date(result.completedAt).toLocaleString()}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge className="text-[9px] px-1.5 py-0 font-semibold bg-muted text-muted-foreground border">
                          {result.totalQuestions} Questions
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      <div className="text-right">
                        <Badge className={`text-xs font-bold px-2.5 py-0.5 border ${badgeColor}`}>
                          {result.earnedMarks} / {result.totalMarks} Marks ({percent}%)
                        </Badge>
                      </div>
                      
                      <Button
                        onClick={() => handleViewResult(result)}
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg text-xs font-semibold px-3"
                      >
                        Review Answers
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

import { useState } from 'react';
import { useStore } from '../../store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { BookOpen, FileText, CheckCircle2, Calendar, Target, Plus, Minus, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { format, isSameDay, subDays, startOfDay, differenceInDays } from 'date-fns';
import { cn } from '../../lib/utils';

export function StatsReviewer() {
  const { files, notes, examDate, dailyGoal, setExamDate, setDailyGoal } = useStore();
  const [filter, setFilter] = useState('all');

  const fileStats = [
    { name: 'Unread', value: files.filter(f => f.status === 'unread').length, color: '#94a3b8' },
    { name: 'Complete', value: files.filter(f => f.status === 'complete').length, color: '#22c55e' },
    { name: 'Review', value: files.filter(f => f.status === 'complete-follow-up').length, color: '#eab308' },
    { name: 'Learn', value: files.filter(f => f.status === 'need-to-learn').length, color: '#ef4444' },
  ].filter(s => s.value > 0);

  const totalFiles = files.length;
  const totalNoteLength = notes.reduce((acc, n) => acc + n.content.length, 0);

  // Real activity data for the last 7 days
  const last7Days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), i)).reverse();
  const activityData = last7Days.map(date => {
    const dayStart = startOfDay(date);
    const revisedCount = files.filter(f => 
      f.revisedAt && isSameDay(new Date(Number(f.revisedAt)), dayStart)
    ).length;
    
    // Also include note updates as "activity"
    const notesCount = notes.filter(n => 
      n.updatedAt && isSameDay(new Date(n.updatedAt), dayStart)
    ).length;

    return {
      day: format(date, 'EEE'),
      fullDate: format(date, 'MMM d'),
      count: revisedCount,
      notes: notesCount,
      // Calculate a "Score" or "Hours" based on activity
      hours: (revisedCount * 0.5) + (notesCount * 0.1) 
    };
  });

  const today = new Date();
  const revisedToday = files.filter(f => 
    f.revisedAt && isSameDay(new Date(Number(f.revisedAt)), today)
  ).length;

  const daysToExam = examDate ? differenceInDays(new Date(examDate), new Date()) : null;

  const filteredNotes = notes.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'global') return n.fileId === 'global';
    if (filter === 'review') {
      const relatedFile = files.find(f => f.id === n.fileId);
      return relatedFile?.status === 'complete-follow-up' || relatedFile?.status === 'need-to-learn';
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <Tabs defaultValue="stats" className="flex-1 flex flex-col h-full">
        <div className="px-4 py-2 border-b bg-muted/20">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="stats">Analytics & Stats</TabsTrigger>
            <TabsTrigger value="reviewer">Notes Reviewer</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="stats" className="flex-1 overflow-y-auto p-4 m-0 min-h-0 data-[state=active]:block">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Files</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalFiles}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Notes Volume</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalNoteLength}</div>
                <p className="text-xs text-muted-foreground">characters written</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{files.filter(f => f.status === 'complete').length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Exam Countdown</CardTitle>
                <Calendar className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline space-x-1">
                  <div className="text-2xl font-bold">{daysToExam !== null ? daysToExam : '--'}</div>
                  <span className="text-xs text-muted-foreground">days left</span>
                </div>
                <input 
                  type="date" 
                  className="mt-2 w-full text-[10px] bg-muted/50 rounded border-none p-1 focus:ring-1 focus:ring-primary outline-none"
                  value={examDate ? format(new Date(examDate), 'yyyy-MM-dd') : ''}
                  onChange={(e) => setExamDate(e.target.value ? new Date(e.target.value).getTime() : null)}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Daily Goal</CardTitle>
                <Target className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold">{revisedToday}/{dailyGoal}</div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => setDailyGoal(dailyGoal + 1)} className="p-0.5 hover:bg-muted rounded"><Plus className="w-3 h-3"/></button>
                    <button onClick={() => setDailyGoal(Math.max(1, dailyGoal - 1))} className="p-0.5 hover:bg-muted rounded"><Minus className="w-3 h-3"/></button>
                  </div>
                </div>
                <div className="mt-2 w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div 
                    className={cn("h-full transition-all duration-500", revisedToday >= dailyGoal ? "bg-green-500" : "bg-primary")} 
                    style={{ width: `${Math.min(100, (revisedToday / dailyGoal) * 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>File Status Distribution</CardTitle>
              </CardHeader>
              <CardContent className="h-[200px]">
                {fileStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={fileStats}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {fileStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No data</div>
                )}
              </CardContent>
            </Card>
            
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Learning Activity</CardTitle>
              </CardHeader>
              <CardContent className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activityData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} fontSize={10} />
                    <YAxis axisLine={false} tickLine={false} fontSize={10} width={20} />
                    <Tooltip 
                      cursor={{fill: 'rgba(59, 130, 246, 0.1)'}} 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-background border rounded-lg p-2 shadow-xl text-[10px]">
                              <p className="font-bold border-b mb-1 pb-1">{data.fullDate}</p>
                              <p className="text-green-500">Revised: {data.count} files</p>
                              <p className="text-blue-500">Notes: {data.notes} updates</p>
                              <p className="text-muted-foreground">Estimated: {data.hours.toFixed(1)}h</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reviewer" className="flex-1 overflow-hidden m-0 flex flex-col min-h-0 data-[state=active]:flex">
          <div className="p-4 border-b flex space-x-2">
            <Badge 
              variant={filter === 'all' ? 'default' : 'outline'} 
              className="cursor-pointer" onClick={() => setFilter('all')}
            >
              All Notes
            </Badge>
            <Badge 
              variant={filter === 'global' ? 'default' : 'outline'} 
              className="cursor-pointer" onClick={() => setFilter('global')}
            >
              Exam Prep Only
            </Badge>
            <Badge 
              variant={filter === 'review' ? 'default' : 'outline'} 
              className="cursor-pointer bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 border-yellow-500/20" 
              onClick={() => setFilter('review')}
            >
              Needs Review
            </Badge>
          </div>
          
          <div className="flex-1 p-4 min-h-0 overflow-y-auto custom-scrollbar">
            <div className="space-y-6 pb-10">
              {filteredNotes.map(note => {
                const file = files.find(f => f.id === note.fileId);
                return (
                  <Card key={note.id} className="overflow-hidden">
                    <div className="bg-muted/50 px-4 py-2 border-b flex justify-between items-center">
                      <span className="font-medium text-sm flex items-center">
                        {note.fileId === 'global' ? <Bot className="w-4 h-4 mr-2 text-orange-500"/> : <FileText className="w-4 h-4 mr-2"/>}
                        {note.fileId === 'global' ? 'Exam Prep (Shared)' : file?.name || 'Unknown File'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(note.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="p-4 prose prose-sm dark:prose-invert max-w-none">
                      {note.content ? <ReactMarkdown>{note.content}</ReactMarkdown> : <span className="italic text-muted-foreground">Empty note</span>}
                    </div>
                  </Card>
                );
              })}
              {filteredNotes.length === 0 && (
                <div className="text-center text-muted-foreground py-10">No notes found matching the filter.</div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

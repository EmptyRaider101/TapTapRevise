import { Desktop } from './components/Desktop';
import { TooltipProvider } from './components/ui/tooltip';
import { Toaster } from './components/ui/sonner';

function App() {
  return (
    <TooltipProvider>
      <Desktop />
      <Toaster />
    </TooltipProvider>
  );
}

export default App;

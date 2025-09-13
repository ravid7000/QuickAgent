import { useEffect, useState } from "react";
import Chat from "@/components/ui/ai/chat";
import { DessertIcon } from 'lucide-react'
import { Button } from "@/components/ui/button";

function App() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    async function run() {
      try {
        // Get the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        const styles = isChatOpen ? {
          width: '400px',
          height: '450px',
        } : {
          width: '48px',
          height: '48px',
        }
        
        // Send message to content script to toggle the chat
        await chrome.tabs.sendMessage(tab.id, { action: 'updateStyles', styles });
      } catch (error) {
        console.error('Error toggling chat:', error);
      }
    }
    run();

  }, [isChatOpen]);

  return (
    <div className="max-w-full h-full flex items-end flex-col gap-4">
      {isChatOpen ? (
        <div className="h-full">
          <Chat onClose={() => setIsChatOpen(false)} />
        </div>
      ) : (
        <Button
          className="rounded-full shadow-md"
          variant="default"
          size="icon_hanging"
          onClick={() => setIsChatOpen(!isChatOpen)}
        >
          <DessertIcon />
        </Button>
      )}
    </div>
  );
}

// function App() {
//   const [_, setIsChatOpen] = useState(false);

//   return (
//     <Chat onClose={() => setIsChatOpen(false)} />
//   );
// }

export default App;

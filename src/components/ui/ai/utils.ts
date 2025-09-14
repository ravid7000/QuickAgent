const headers = new Headers();

headers.append('Content-Type', 'application/json');

type ChatMessage = {
  id: string;
  content: string;
  role: "user" | "assistant" | "system";
  timestamp: Date;
  reasoning?: string;
  sources?: Array<{ title: string; url: string }>;
};

export async function callModel(messages: ChatMessage[]): Promise<{
  choices?: Array<{
    message: {
      content: string;
      role: string;
    };
  }>;
  error?: {
    message: string;
  };
}> {
  try {
    const response = await fetch('https://api.fuelix.ai/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: messages.map((message) => ({
          user: message.role,
          content: message.reasoning || message.content,
        }))
      })
    });
    
    return await response.json();
  } catch (err) {
    console.log('failed to fetch model', err);
    return {}
  }
}
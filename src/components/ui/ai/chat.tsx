import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ui/ai/conversation";
import {
  Message,
  // MessageAvatar,
  MessageContent,
} from "@/components/ui/ai/message";
import {
  PromptInput,
  // PromptInputButton,
  //   PromptInputModelSelect,
  //   PromptInputModelSelectContent,
  //   PromptInputModelSelectItem,
  //   PromptInputModelSelectTrigger,
  //   PromptInputModelSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  // PromptInputToolbar,
  // PromptInputTools,
} from "@/components/ui/ai/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ui/ai/reasoning";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ui/ai/source";
import { Button } from "@/components/ui/button";
import BrowserActionService from "@/services/browserActionService";
import { XIcon } from "lucide-react";
import { nanoid } from "nanoid";
import { type FormEventHandler, useCallback, useState } from "react";
import { callModel } from "./utils";
import { getBrowserActionPrompt } from "@/utils/browserActionDefinitions";
// import { Avatar, AvatarFallback, AvatarImage } from "../avatar";
type ChatMessage = {
  id: string;
  content: string;
  role: "user" | "assistant" | "system";
  timestamp: Date;
  reasoning?: string;
  sources?: Array<{ title: string; url: string }>;
};
// const models = [
//   { id: "gpt-4o", name: "GPT-4o" },
//   { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet" },
//   { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" },
//   { id: "llama-3.1-70b", name: "Llama 3.1 70B" },
// ];
// Context management configuration
const CONTEXT_CONFIG = {
  maxMessages: 8,        // Maximum number of recent messages to keep
  maxTokens: 2000,       // Maximum token count for context
  maxIterations: 10,     // Maximum loop iterations
  iterationDelay: 1000,  // Delay between iterations (ms)
} as const;

const Chat = ({ onClose }: { onClose: () => void }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [inputValue, setInputValue] = useState("");
  // const [selectedModel, setSelectedModel] = useState(models[0].id);
  const [isTyping, setIsTyping] = useState(false);



  const handleSubmit: FormEventHandler<HTMLFormElement> = useCallback(
    async (event) => {
      event.preventDefault();

      if (!inputValue.trim() || isTyping) return;

      // Handle browser actions from AI responses
      async function handleBrowserAction(
        action: Record<string, unknown>
      ): Promise<string> {
        try {
          const browserActionService = BrowserActionService.getInstance();
          let result;

          const params = action.params as Record<string, unknown>;

          switch (action.function) {
            case "browser_click":
              result = await browserActionService.click(
                params.element as string,
                params.ref as string,
                {
                  doubleClick: params.doubleClick as boolean,
                  button: params.button as "left" | "right" | "middle",
                  modifiers: params.modifiers as (
                    | "Alt"
                    | "Control"
                    | "ControlOrMeta"
                    | "Meta"
                    | "Shift"
                  )[],
                }
              );
              break;
            case "browser_evaluate":
              result = await browserActionService.evaluate(
                params.function as string,
                params.element as string,
                params.ref as string
              );
              break;
            case "browser_file_upload":
              result = await browserActionService.fileUpload(
                params.paths as string[]
              );
              break;
            case "browser_fill_form":
              result = await browserActionService.fillForm(
                params.fields as Array<{
                  name: string;
                  type:
                    | "textbox"
                    | "checkbox"
                    | "radio"
                    | "combobox"
                    | "slider";
                  ref: string;
                  value: string | boolean;
                }>
              );
              break;
            case "browser_navigate":
              result = await browserActionService.navigate(
                params.url as string
              );
              break;
            case "browser_navigate_back":
              result = await browserActionService.navigateBack();
              break;
            case "browser_press_key":
              result = await browserActionService.pressKey(
                params.key as string
              );
              break;
            case "browser_select_option":
              result = await browserActionService.selectOption(
                params.element as string,
                params.ref as string,
                params.values as string[]
              );
              break;
            case "browser_snapshot":
              result = await browserActionService.snapshot();
              break;
            case "browser_wait_for":
              result = await browserActionService.waitFor(
                params as {
                  time?: number;
                  text?: string;
                  textGone?: string;
                }
              );
              break;
            default:
              return `Unknown browser action: ${action.function}`;
          }

          if (result.success) {
            return `✅ Browser action "${
              action.function
            }" executed successfully. ${JSON.stringify(result.data)}`;
          } else {
            return `❌ Browser action "${action.function}" failed: ${result.error}`;
          }
        } catch (error) {
          return `❌ Error executing browser action: ${error}`;
        }
      }

      // Parse AI response for browser actions and return both processed content and whether actions were found
      async function parseAndExecuteActions(content: string): Promise<{
        processedContent: string;
        hasActions: boolean;
        functionName: string;
      }> {
        try {
          let processedContent = content;
          let hasActions = false;
          let functionName = "";

          // Look for single JSON objects
          const jsonMatches = processedContent.match(
            /\{\s*"function"\s*:\s*"([^"]+)"\s*,\s*"params"\s*:\s*(\{(?:[^{}]|{[^}]*})*\})\s*\}/g
          );

          if (jsonMatches) {
            hasActions = true;
            for (const jsonMatch of jsonMatches) {
              try {
                const action = JSON.parse(jsonMatch);
                if (action.function && action.function.startsWith("browser_")) {
                  functionName = action.function;
                  const actionResult = await handleBrowserAction(action);
                  processedContent = processedContent.replace(
                    jsonMatch,
                    actionResult
                  );
                }
              } catch (parseError) {
                console.log("object parsing error", parseError);
                continue;
              }
            }
          }

          return { processedContent, hasActions, functionName };
        } catch (error) {
          console.log("error", error);
          return { processedContent: content, hasActions: false, functionName: "" };
        }
      }

      // const initialSnapshot = await parseAndExecuteActions(`{"function": "browser_snapshot", "params": {}}`);

      // Add user message
      const userMessage: ChatMessage = {
        id: nanoid(),
        content: inputValue.trim(),
        role: "user",
        timestamp: new Date(),
      };
      const sytemMessage: ChatMessage = {
        id: nanoid(),
        content: getBrowserActionPrompt(),
        role: "system",
        timestamp: new Date(),
      }
      // const initialSnapshotMessage: ChatMessage = {
      //   id: nanoid(),
      //   content: initialSnapshot.processedContent,
      //   role: "system",
      //   timestamp: new Date(),
      // }
      setMessages((prev) => [...prev, userMessage]);
      setInputValue("");
      setIsTyping(true);
      // Simulate AI response with delay

      const updateMessages = [
        sytemMessage,
        // initialSnapshotMessage,
        userMessage,
      ];

      const response = await callModel(updateMessages);

      console.log({ response });

      // Context management utilities
      function getLeanContext(messages: ChatMessage[]): ChatMessage[] {
        // Always include system message if present
        const systemMessage = messages.find(msg => msg.role === "system");
        const otherMessages = messages.filter(msg => msg.role !== "system");
        
        // If we have few messages, return them all
        if (otherMessages.length <= CONTEXT_CONFIG.maxMessages) {
          return systemMessage ? [systemMessage, ...otherMessages] : otherMessages;
        }
        
        // Take the most recent messages (sliding window)
        let recentMessages = otherMessages.slice(-CONTEXT_CONFIG.maxMessages);
        let tokenCount = estimateTokenCount(recentMessages);
        
        // If still too many tokens, reduce the window
        while (tokenCount > CONTEXT_CONFIG.maxTokens && recentMessages.length > 2) {
          recentMessages = recentMessages.slice(1); // Remove oldest message
          tokenCount = estimateTokenCount(recentMessages);
        }
        
        // If we have a system message, add it back
        if (systemMessage) {
          recentMessages = [systemMessage, ...recentMessages];
        }
        
        return recentMessages;
      }

      function estimateTokenCount(messages: ChatMessage[]): number {
        // Rough estimation: 1 token ≈ 4 characters
        return messages.reduce((total, msg) => {
          return total + Math.ceil(msg.content.length / 4);
        }, 0);
      }

      function createContextSummary(messages: ChatMessage[]): string {
        // Create a brief summary of the conversation for very long contexts
        const userMessages = messages.filter(msg => msg.role === "user");
        const assistantMessages = messages.filter(msg => msg.role === "assistant");
        
        return `[Context Summary: ${userMessages.length} user messages, ${assistantMessages.length} assistant responses. Recent conversation continues...]`;
      }

      // Recursive function to handle the conversation loop
      async function processConversationLoop(
        conversationHistory: ChatMessage[],
        maxIterations: number = CONTEXT_CONFIG.maxIterations
      ): Promise<void> {
        if (maxIterations <= 0) {
          console.log("Max iterations reached, stopping loop");
          return;
        }

        // Get lean context for this iteration
        const leanContext = getLeanContext(conversationHistory);
        
        // If we had to truncate significantly, add a context summary
        let finalContext = leanContext;
        if (conversationHistory.length > leanContext.length + 2) {
          const summaryMessage: ChatMessage = {
            id: nanoid(),
            content: createContextSummary(conversationHistory),
            role: "system",
            timestamp: new Date(),
          };
          finalContext = [summaryMessage, ...leanContext];
        }
        
        console.log(`Calling model with ${finalContext.length} messages (~${estimateTokenCount(finalContext)} tokens)`);

        const response = await callModel(finalContext);
        console.log({ response });

        const content = response.choices?.[0].message?.content ?? "";
        const { processedContent, hasActions, functionName } = await parseAndExecuteActions(content);

        // Create assistant message
        const assistantMessage: ChatMessage = {
          id: nanoid(),
          content: hasActions ? functionName : processedContent,
          role: "assistant",
          reasoning: hasActions ? processedContent : "",
          timestamp: new Date(),
        };

        // Add assistant message to the conversation
        setMessages((prev) => [...prev, assistantMessage]);

        // If there were actions executed, continue the loop
        if (hasActions) {
          // Add the assistant message to the conversation history for the next call
          const updatedHistory = [...conversationHistory, assistantMessage];
          
          // Continue the loop with updated history
          setTimeout(() => {
            processConversationLoop(updatedHistory, maxIterations - 1);
          }, CONTEXT_CONFIG.iterationDelay);
        }
      }

      // Start the conversation loop
      try {
        await processConversationLoop(updateMessages);
      } catch (error) {
        console.error("Error in conversation loop:", error);
      } finally {
        setIsTyping(false);
      }
    },
    [inputValue, isTyping]
  );
  const handleReset = useCallback(() => {
    setMessages([]);
    setInputValue("");
    setIsTyping(false);
    onClose();
  }, [onClose]);
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border bg-background shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between bg-white px-4 py-3">
        {/* <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Avatar>
                <AvatarImage src="https://github.com/dovazencot.png" />
                <AvatarFallback>QA</AvatarFallback>
            </Avatar>
            <div className="w-8 h-8 rounded-md bg-primary inline-flex items-center justify-center text-white text-sm">QA</div>
            <span className="font-medium text-sm">QuickAgent</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <span className="text-muted-foreground text-xs">
            {models.find((m) => m.id === selectedModel)?.name}
          </span>
        </div> */}
        <div className="ml-auto" />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="h-8 px-2 rounded-full"
        >
          <XIcon className="size-4" />
        </Button>
      </div>
      {/* Conversation Area */}
      <Conversation className="flex-1">
        <ConversationContent className="space-y-4">
          {messages.map((message) => (
            <div key={message.id}>
              <Message from={message.role}>
                <MessageContent>
                  {message.content}
                </MessageContent>
                {/* <MessageAvatar
                  src={
                    message.role === "user"
                      ? "https://github.com/dovazencot.png"
                      : "https://github.com/vercel.png"
                  }
                  name={message.role === "user" ? "User" : "AI"}
                /> */}
              </Message>
              {/* Reasoning */}
              {message.reasoning && (
                <div className="ml-2">
                  <Reasoning
                    isStreaming={false}
                    defaultOpen={false}
                    className="text-xs"
                  >
                    <ReasoningTrigger />
                    <ReasoningContent>{message.reasoning}</ReasoningContent>
                  </Reasoning>
                </div>
              )}
              {/* Sources */}
              {message.sources && message.sources.length > 0 && (
                <div className="ml-2">
                  <Sources>
                    <SourcesTrigger count={message.sources.length} />
                    <SourcesContent>
                      {message.sources.map((source, index) => (
                        <Source
                          key={index}
                          href={source.url}
                          title={source.title}
                        />
                      ))}
                    </SourcesContent>
                  </Sources>
                </div>
              )}
            </div>
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      {/* Input Area */}
      <div className="border-t p-4">
        <PromptInput className="flex gap-2" onSubmit={handleSubmit}>
          <PromptInputTextarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="How can I help you today?"
            disabled={isTyping}
          />
          <div className="p-2">
            <PromptInputSubmit
              disabled={!inputValue.trim() || isTyping}
              status={isTyping ? "streaming" : "ready"}
            />
          </div>
          {/* <PromptInputToolbar>
            <PromptInputTools>
              <PromptInputButton disabled={isTyping}>
                <PaperclipIcon size={16} />
              </PromptInputButton>
              <PromptInputButton disabled={isTyping}>
                <MicIcon size={16} />
                <span>Voice</span>
              </PromptInputButton>
              <PromptInputModelSelect
                value={selectedModel}
                onValueChange={setSelectedModel}
                disabled={isTyping}
              >
                <PromptInputModelSelectTrigger>
                  <PromptInputModelSelectValue />
                </PromptInputModelSelectTrigger>
                <PromptInputModelSelectContent>
                  {models.map((model) => (
                    <PromptInputModelSelectItem key={model.id} value={model.id}>
                      {model.name}
                    </PromptInputModelSelectItem>
                  ))}
                </PromptInputModelSelectContent>
              </PromptInputModelSelect>
            </PromptInputTools>
            <PromptInputSubmit
              disabled={!inputValue.trim() || isTyping}
              status={isTyping ? "streaming" : "ready"}
            />
          </PromptInputToolbar> */}
        </PromptInput>
      </div>
    </div>
  );
};
export default Chat;

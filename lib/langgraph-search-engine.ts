/**
 * LangGraph Search Engine
 * 
 * REFACTORED: Extracted node handlers to search-engine/nodes.ts
 * Reduced from ~1435 lines to ~250 lines for the core orchestrator.
 * 
 * The core orchestrator using LangGraph for state management.
 * Node logic is now modular and testable via search-engine/nodes.ts
 */

import { StateGraph, END, START, MemorySaver } from "@langchain/langgraph";
import { FirecrawlClient } from './firecrawl';
import { ContextProcessor } from './context-processor';
import { SEARCH_CONFIG, MODEL_CONFIG } from './config';
import { UnifiedSearchProvider } from './providers';
import { Source, SearchResult, SearchPhase, SearchEvent, ErrorType, SearchStep } from './types';
import { ResponsesAPIClient } from './openai-responses';
import { loggers } from './utils/logger';

// Import modular components
import { SearchStateAnnotation, type SearchState } from './search-engine/state';
import { getInitialSteps, type GraphConfig } from './search-engine/helpers';
import {
  createUnderstandNode,
  createPlanNode,
  createSearchNode,
  createScrapeNode,
  createAnalyzeNode,
  createSynthesizeNode,
  createHandleErrorNode,
  createCompleteNode,
  type NodeDependencies
} from './search-engine/nodes';

const log = loggers.core;

// Re-export types for backwards compatibility
export type { Source, SearchResult, SearchPhase, SearchEvent, ErrorType, SearchStep };

export class LangGraphSearchEngine {
  private firecrawl: FirecrawlClient;
  private unifiedSearch: UnifiedSearchProvider;
  private contextProcessor: ContextProcessor;
  private graph: ReturnType<typeof this.buildGraph>;
  private llm: ResponsesAPIClient;
  private streamingLlm: ResponsesAPIClient;
  private checkpointer?: MemorySaver;
  private nodeDeps: NodeDependencies;

  constructor(firecrawl: FirecrawlClient, options?: { enableCheckpointing?: boolean }) {
    this.firecrawl = firecrawl;
    this.unifiedSearch = new UnifiedSearchProvider(firecrawl);
    this.contextProcessor = new ContextProcessor();
    
    // Initialize GPT-5.2 Responses API clients
    this.llm = new ResponsesAPIClient({
      model: MODEL_CONFIG.FAST_MODEL,
      reasoning: { effort: MODEL_CONFIG.REASONING_EFFORT },
      text: { verbosity: MODEL_CONFIG.VERBOSITY },
      temperature: MODEL_CONFIG.TEMPERATURE,
    });
    
    this.streamingLlm = new ResponsesAPIClient({
      model: MODEL_CONFIG.QUALITY_MODEL,
      reasoning: { effort: MODEL_CONFIG.REASONING_EFFORT },
      text: { verbosity: MODEL_CONFIG.VERBOSITY },
      temperature: MODEL_CONFIG.TEMPERATURE,
    });

    // Enable checkpointing if requested
    if (options?.enableCheckpointing) {
      this.checkpointer = new MemorySaver();
    }

    // Create shared dependencies for nodes
    this.nodeDeps = {
      firecrawl: this.firecrawl,
      unifiedSearch: this.unifiedSearch,
      contextProcessor: this.contextProcessor,
      llm: this.llm,
      streamingLlm: this.streamingLlm,
    };
    
    // Log available search providers
    const providerStatus = this.unifiedSearch.getProviderStatus();
    log.info('Search providers:', Object.entries(providerStatus)
      .map(([p, s]) => `${p}: ${s ? '✓' : '✗'}`)
      .join(', ')
    );
    
    this.graph = this.buildGraph();
  }

  getInitialSteps(): SearchStep[] {
    return getInitialSteps();
  }

  private buildGraph() {
    // Create nodes using factory functions with injected dependencies
    const understandNode = createUnderstandNode(this.nodeDeps);
    const planNode = createPlanNode(this.nodeDeps);
    const searchNode = createSearchNode(this.nodeDeps);
    const scrapeNode = createScrapeNode(this.nodeDeps);
    const analyzeNode = createAnalyzeNode(this.nodeDeps);
    const synthesizeNode = createSynthesizeNode(this.nodeDeps);
    const handleErrorNode = createHandleErrorNode();
    const completeNode = createCompleteNode();
    
    const workflow = new StateGraph(SearchStateAnnotation)
      .addNode("understand", understandNode)
      .addNode("plan", planNode)
      .addNode("search", searchNode)
      .addNode("scrape", scrapeNode)
      .addNode("analyze", analyzeNode)
      .addNode("synthesize", synthesizeNode)
      .addNode("handleError", handleErrorNode)
      .addNode("complete", completeNode);

    // Add edges with proper conditional routing
    workflow
      .addEdge(START, "understand")
      .addConditionalEdges(
        "understand",
        (state: SearchState) => state.phase === 'error' ? "handleError" : "plan",
        { handleError: "handleError", plan: "plan" }
      )
      .addConditionalEdges(
        "plan",
        (state: SearchState) => state.phase === 'error' ? "handleError" : "search",
        { handleError: "handleError", search: "search" }
      )
      .addConditionalEdges(
        "search",
        (state: SearchState) => {
          if (state.phase === 'error') return "handleError";
          if ((state.currentSearchIndex || 0) < (state.searchQueries?.length || 0)) return "search";
          return "scrape";
        },
        { handleError: "handleError", search: "search", scrape: "scrape" }
      )
      .addConditionalEdges(
        "scrape",
        (state: SearchState) => state.phase === 'error' ? "handleError" : "analyze",
        { handleError: "handleError", analyze: "analyze" }
      )
      .addConditionalEdges(
        "analyze",
        (state: SearchState) => {
          if (state.phase === 'error') return "handleError";
          if (state.phase === 'planning') return "plan";
          return "synthesize";
        },
        { handleError: "handleError", plan: "plan", synthesize: "synthesize" }
      )
      .addConditionalEdges(
        "synthesize",
        (state: SearchState) => state.phase === 'error' ? "handleError" : "complete",
        { handleError: "handleError", complete: "complete" }
      )
      .addConditionalEdges(
        "handleError",
        (state: SearchState) => state.phase === 'error' ? END : "understand",
        { [END]: END, understand: "understand" }
      )
      .addEdge("complete", END);

    // Compile with optional checkpointing
    return workflow.compile(this.checkpointer ? { checkpointer: this.checkpointer } : undefined);
  }

  async search(
    query: string,
    onEvent: (event: SearchEvent) => void,
    context?: { query: string; response: string }[],
    checkpointId?: string
  ): Promise<void> {
    try {
      const initialState: SearchState = {
        query,
        context,
        sources: [],
        scrapedSources: [],
        processedSources: undefined,
        phase: 'understanding',
        currentSearchIndex: 0,
        maxRetries: SEARCH_CONFIG.MAX_RETRIES,
        retryCount: 0,
        understanding: undefined,
        searchQueries: undefined,
        finalAnswer: undefined,
        followUpQuestions: undefined,
        error: undefined,
        errorType: undefined,
        subQueries: undefined,
        searchAttempt: 0,
        searchProvider: undefined,
        providerReason: undefined,
        preAnswer: undefined,
        urlSources: undefined,
        previousResponseId: undefined,
        researchDomain: undefined,
        researchContext: undefined,
        enrichedSources: undefined,
      };

      const config: GraphConfig = {
        configurable: {
          eventCallback: onEvent,
          ...(checkpointId && this.checkpointer ? { thread_id: checkpointId } : {})
        }
      };

      // Invoke the graph with increased recursion limit
      await this.graph.invoke(initialState, {
        ...config,
        recursionLimit: 35
      });
    } catch (error) {
      onEvent({
        type: 'error',
        error: error instanceof Error ? error.message : 'Search failed',
        errorType: 'unknown'
      });
    }
  }
}

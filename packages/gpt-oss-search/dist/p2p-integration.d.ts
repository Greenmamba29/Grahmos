import type { SemanticSearchQuery, SemanticSearchResponse, SemanticUpdate } from './types';
export interface P2PNode {
    nodeId: string;
    emit(event: string, data: any): boolean;
    on(event: string, handler: (data: any) => void): void;
}
export declare class SemanticSearchP2PBridge {
    private p2pNode;
    private messageHandlers;
    private semanticQueries;
    constructor(p2pNode?: P2PNode);
    initialize(p2pNode: P2PNode): Promise<void>;
    broadcastQuery(query: SemanticSearchQuery): Promise<void>;
    broadcastResponse(response: SemanticSearchResponse): Promise<void>;
    broadcastUpdate(update: SemanticUpdate): Promise<void>;
    private handleSemanticMessage;
    private handleRemoteQuery;
    private handleRemoteResponse;
    private handleRemoteUpdate;
    private handlePeerConnected;
    private handlePeerDisconnected;
    private eventListeners;
    on(event: string, handler: Function): void;
    off(event: string, handler: Function): void;
    private emit;
    getNetworkStats(): {
        activeQueries: number;
        totalQueries: number;
        connectedPeers: number;
    };
    cleanup(maxAge?: number): void;
    dispose(): void;
}
export declare class CollaborativeSemanticSearch {
    private p2pBridge;
    private localEngine;
    private collaborativeResults;
    constructor(localEngine: any, p2pNode?: P2PNode);
    initialize(p2pNode: P2PNode): Promise<void>;
    collaborativeSearch(query: SemanticSearchQuery): Promise<SemanticSearchResponse>;
    private waitForCollaborativeResponses;
    private handleCollaborativeResponse;
    private handleCollaborativeUpdate;
    private mergeSemanticResponses;
    dispose(): void;
}
//# sourceMappingURL=p2p-integration.d.ts.map
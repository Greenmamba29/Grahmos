import type { Request, Response, NextFunction } from 'express';
/**
 * DPoP middleware - validates DPoP proof if present
 */
export declare function requireDPoP(req: Request, res: Response, next: NextFunction): void | Response<any, Record<string, any>>;
/**
 * PoP JWT validation middleware
 */
export declare function requirePoPJWT(req: Request, res: Response, next: NextFunction): void | Response<any, Record<string, any>>;
//# sourceMappingURL=dpop.d.ts.map
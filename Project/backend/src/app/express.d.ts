export interface AuthContext {
  userId: string;
  tenantId: string;
  sessionId: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export {};

import type { NextFunction, Request, Response } from "express";

// Placeholder de autenticação serviço-a-serviço (ADR 0006) — alvo #5 do edital: consumido por
// outros sistemas internos, não por navegador anônimo. Não é uma solução de segurança de produção.
export function apiKeyMiddleware(expectedKey: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

    if (token !== expectedKey) {
      res.status(401).json({ error: { code: "unauthorized", message: "API key ausente ou inválida" } });
      return;
    }
    next();
  };
}

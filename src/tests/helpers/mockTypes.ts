import type { Request, Response } from 'express';
import type { Server } from 'node:http';
export type { AddressInfo } from 'node:net';

/** JSON documents used by the small in-memory database doubles. */
export type TestDocument = Record<string, unknown>;
export interface TestDocumentReference { id: string; key: string }
export interface TestSnapshot {
  exists: boolean;
  id?: string;
  data(): TestDocument | undefined;
}
export interface TestTransaction {
  get(ref: TestDocumentReference): Promise<TestSnapshot>;
  update(ref: TestDocumentReference, data: TestDocument): void;
  set(ref: TestDocumentReference, data: TestDocument): void;
}
export interface TestReconcileTransaction extends TestTransaction {
  create(ref: TestDocumentReference, data: TestDocument): void;
  getAll(...refs: TestDocumentReference[]): Promise<TestSnapshot[]>;
}
export interface TestResponseBody {
  status?: string;
  message?: string;
  error?: string;
  details?: unknown[];
  code?: string;
  cap?: number;
  current?: number;
  data?: { pdfBase64?: string };
}
export type TestRequest = Request & { user?: { uid: string; email?: string; admin?: boolean } };
export type ListeningServer = Server;
export type CapturedResponse = Response & { jsonBody: TestResponseBody; statusCode: number };

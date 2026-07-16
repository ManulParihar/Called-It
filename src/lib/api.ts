// Typed wrappers around the room API. The screens call these instead of using
// fetch directly, so all the request and response shapes live in one place.

import type { Fixture, RoomBundle, Swipe } from "./types";
import type { TeamSide } from "./match";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (body as { error?: string }).error ?? "Request failed";
    throw new Error(message);
  }
  return body as T;
}

export function listFixtures(): Promise<{ fixtures: Fixture[] }> {
  return request("/api/fixtures");
}

export interface CreateRoomBody {
  userId: string;
  displayName: string;
  mascotId: string;
  fixtureId: string;
  teamA: TeamSide;
  wagerType: "money" | "forfeit";
  stakeUsd?: number;
  payoutMode: "winner_takes_all" | "top_three" | "all_but_loser";
  forfeitText?: string | null;
  walletAddress?: string | null;
}

export function createRoom(body: CreateRoomBody): Promise<RoomBundle> {
  return request("/api/rooms", { method: "POST", body: JSON.stringify(body) });
}

export function getRoom(code: string): Promise<RoomBundle> {
  return request(`/api/rooms/${encodeURIComponent(code)}`);
}

export interface JoinRoomBody {
  userId: string;
  displayName: string;
  mascotId: string;
  walletAddress?: string | null;
}

export function joinRoom(code: string, body: JoinRoomBody): Promise<RoomBundle> {
  return request(`/api/rooms/${encodeURIComponent(code)}/join`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export interface AnswerInput {
  questionId: string;
  choice: Swipe;
}

export function submitAnswers(
  code: string,
  memberId: string,
  answers: AnswerInput[],
): Promise<{ saved: boolean }> {
  return request(`/api/rooms/${encodeURIComponent(code)}/answers`, {
    method: "POST",
    body: JSON.stringify({ memberId, answers }),
  });
}

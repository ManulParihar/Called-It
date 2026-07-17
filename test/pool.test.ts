import assert from "node:assert/strict";
import { test } from "node:test";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  derivePoolPda,
  deriveVaultPda,
  roomSeedFromCode,
} from "../src/lib/solana/pool";

const PROGRAM_ID = new PublicKey("11111111111111111111111111111111");

test("a room code always makes the same 16 byte seed", () => {
  const a = roomSeedFromCode("GA5SNX");
  const b = roomSeedFromCode("GA5SNX");
  assert.equal(a.length, 16);
  assert.deepEqual([...a], [...b]);
});

test("different codes make different seeds", () => {
  const a = roomSeedFromCode("GA5SNX");
  const b = roomSeedFromCode("ZZZ999");
  assert.notDeepEqual([...a], [...b]);
});

test("the pool address is stable for the same creator and code", () => {
  const creator = Keypair.generate().publicKey;
  const seed = roomSeedFromCode("GA5SNX");
  const [poolA] = derivePoolPda(PROGRAM_ID, creator, seed);
  const [poolB] = derivePoolPda(PROGRAM_ID, creator, seed);
  assert.equal(poolA.toBase58(), poolB.toBase58());
});

test("a different creator gets a different pool", () => {
  const seed = roomSeedFromCode("GA5SNX");
  const [poolA] = derivePoolPda(PROGRAM_ID, Keypair.generate().publicKey, seed);
  const [poolB] = derivePoolPda(PROGRAM_ID, Keypair.generate().publicKey, seed);
  assert.notEqual(poolA.toBase58(), poolB.toBase58());
});

test("the vault is derived from the pool and is stable", () => {
  const creator = Keypair.generate().publicKey;
  const [pool] = derivePoolPda(PROGRAM_ID, creator, roomSeedFromCode("GA5SNX"));
  const [vaultA] = deriveVaultPda(PROGRAM_ID, pool);
  const [vaultB] = deriveVaultPda(PROGRAM_ID, pool);
  assert.equal(vaultA.toBase58(), vaultB.toBase58());
});

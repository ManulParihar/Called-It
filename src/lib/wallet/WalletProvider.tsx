"use client";

// Mounts the wallet backends and picks which one is active.
//
// The wallet adapter is always available so a player can connect an existing
// wallet in either mode. On top of that, local mode defaults to a browser
// keypair, and the live app defaults to Privy when an app id is set. Screens
// read the active wallet through useAppWallet and can switch to another backend
// with setKind.

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  ConnectionProvider as RawConnectionProvider,
  WalletProvider as RawAdapterProvider,
} from "@solana/wallet-adapter-react";
import { PrivyProvider as RawPrivyProvider } from "@privy-io/react-auth";
import { solanaRpcUrl } from "../solana/connection";
import type { AppWallet, WalletKind } from "./types";
import { useLocalWallet } from "./useLocalWallet";
import { useAdapterWallet } from "./useAdapterWallet";
import { usePrivyWallet } from "./usePrivyWallet";

// These providers ship their own React types, and the wallet packages pull in a
// newer copy through their mobile dependencies. Pinning them to the app's React
// component shape here keeps the two type versions from clashing at the call
// site. Behaviour is unchanged; only the type is narrowed to what we pass.
const ConnectionProvider = RawConnectionProvider as ComponentType<{
  endpoint: string;
  children: ReactNode;
}>;
const AdapterProvider = RawAdapterProvider as ComponentType<{
  wallets: never[];
  autoConnect: boolean;
  children: ReactNode;
}>;
const PrivyProvider = RawPrivyProvider as ComponentType<{
  appId: string;
  config: { embeddedWallets: { createOnLogin: "users-without-wallets" } };
  children: ReactNode;
}>;

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const LOCAL_MODE = process.env.NEXT_PUBLIC_LOCAL_DB === "1";

interface WalletContextValue {
  wallet: AppWallet;
  kind: WalletKind;
  kinds: WalletKind[];
  setKind: (kind: WalletKind) => void;
}

const WalletCtx = createContext<WalletContextValue | null>(null);

export function useAppWallet(): WalletContextValue {
  const value = useContext(WalletCtx);
  if (!value) throw new Error("useAppWallet must be used inside WalletProviders");
  return value;
}

// Live path: Privy plus the adapter as an alternative. Only rendered when a
// Privy app id is set, so the Privy hooks always have their provider.
function PrivyInner({ children }: { children: ReactNode }) {
  const [kind, setKind] = useState<WalletKind>("privy");
  const privy = usePrivyWallet();
  const adapter = useAdapterWallet();
  const wallet = kind === "adapter" ? adapter : privy;
  const value = useMemo(
    () => ({ wallet, kind, kinds: ["privy", "adapter"] as WalletKind[], setKind }),
    [wallet, kind],
  );
  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>;
}

// Local and live-without-Privy path: a browser keypair plus the adapter. No
// Privy hooks are called here, so no Privy provider is needed.
function BasicInner({ children }: { children: ReactNode }) {
  const [kind, setKind] = useState<WalletKind>(LOCAL_MODE ? "local" : "adapter");
  const local = useLocalWallet();
  const adapter = useAdapterWallet();
  const wallet = kind === "adapter" ? adapter : local;
  const value = useMemo(
    () => ({ wallet, kind, kinds: ["local", "adapter"] as WalletKind[], setKind }),
    [wallet, kind],
  );
  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>;
}

export function WalletProviders({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => solanaRpcUrl(), []);

  const inner = PRIVY_APP_ID ? (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{ embeddedWallets: { createOnLogin: "users-without-wallets" } }}
    >
      <PrivyInner>{children}</PrivyInner>
    </PrivyProvider>
  ) : (
    <BasicInner>{children}</BasicInner>
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <AdapterProvider wallets={[]} autoConnect={false}>
        {inner}
      </AdapterProvider>
    </ConnectionProvider>
  );
}

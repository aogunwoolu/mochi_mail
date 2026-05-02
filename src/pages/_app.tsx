import type { AppProps } from "next/app";
import { MochiProvider } from "@/context/MochiContext";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <MochiProvider>
      <Component {...pageProps} />
    </MochiProvider>
  );
}

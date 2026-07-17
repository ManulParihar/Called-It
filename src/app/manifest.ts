import type { MetadataRoute } from "next";

// Basic install manifest so the game can be added to a home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Called It",
    short_name: "Called It",
    description: "Predict the match with your friends and see who called it.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    // Matches the pitch dark in globals.css and the themeColor in layout.tsx.
    background_color: "#0e211a",
    theme_color: "#0e211a",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}

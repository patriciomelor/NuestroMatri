import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NuestroMatri",
    short_name: "NuestroMatri",
    description: "Planifiquen su boda en un solo lugar.",
    start_url: "/",
    display: "standalone",
    background_color: "#fff6ea",
    theme_color: "#54234f",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
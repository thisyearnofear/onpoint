import type { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/base-url";

const BASE_URL = getBaseUrl();

export default function sitemap(): MetadataRoute.Sitemap {
  const currentDate = new Date();

  return [
    // Core pages
    { url: BASE_URL, lastModified: currentDate, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE_URL}/lab`, lastModified: currentDate, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/about`, lastModified: currentDate, changeFrequency: "monthly", priority: 0.7 },

    // Curator pages
    { url: `${BASE_URL}/curator`, lastModified: currentDate, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/curator/onboard`, lastModified: currentDate, changeFrequency: "monthly", priority: 0.6 },

    // Guides index
    { url: `${BASE_URL}/guides`, lastModified: currentDate, changeFrequency: "weekly", priority: 0.8 },

    // Style guide articles
    { url: `${BASE_URL}/guides/football-kits`, lastModified: currentDate, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/guides/ankara-style`, lastModified: currentDate, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/guides/streetwear-fits`, lastModified: currentDate, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/guides/vintage-thrifting`, lastModified: currentDate, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/guides/formal-wear`, lastModified: currentDate, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/guides/sneaker-care`, lastModified: currentDate, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/guides/sustainable-fashion`, lastModified: currentDate, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/guides/accessories-styling`, lastModified: currentDate, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/guides/plus-size-fashion`, lastModified: currentDate, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/guides/occasion-wear`, lastModified: currentDate, changeFrequency: "monthly", priority: 0.7 },

    // Functional pages
    { url: `${BASE_URL}/privacy`, lastModified: currentDate, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/pricing`, lastModified: currentDate, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/style-guide`, lastModified: currentDate, changeFrequency: "monthly", priority: 0.3 },
  ];
}

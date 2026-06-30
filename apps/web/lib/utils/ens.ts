// ENS resolution utilities using ensdata.net (CORS-friendly alternative to eth.merkle.io)

/**
 * Resolve an ENS name to an Ethereum address
 */
export async function resolveENSName(name: string): Promise<string | null> {
  try {
    const response = await fetch(`https://ensdata.net/${name}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.address || null;
  } catch (error) {
    console.warn("ENS resolution failed:", error);
    return null;
  }
}

/**
 * Get ENS avatar URL for a name. The endpoint returns the binary image
 * data which we surface via the `api.ensdata.net` host that is wired in
 * to the redirect chain.
 */
export async function getENSAvatar(name: string): Promise<string | null> {
  try {
    const response = await fetch(`https://ensdata.net/media/avatar/${name}`, {
      method: "GET",
      redirect: "follow",
    });

    if (!response.ok) {
      return null;
    }

    // The endpoint serves the binary image — return the resolved URL so
    // the caller can use it as an <img src>. The redirect target lands
    // on api.ensdata.net and is CORS-allowed.
    return response.url || `https://api.ensdata.net/media/avatar/${name}`;
  } catch (error) {
    console.warn("ENS avatar resolution failed:", error);
    return null;
  }
}

/**
 * Get complete ENS data for a name
 */
export async function getENSData(name: string): Promise<any | null> {
  try {
    const response = await fetch(`https://ensdata.net/${name}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.warn("ENS data fetch failed:", error);
    return null;
  }
}

/**
 * Resolve an Ethereum address to ENS name
 *
 * ensdata.net returns reverse-resolution data under the `ens_primary` key
 * (and additionally `ens` for the canonical name and `display` for short
 * form). Older versions of the API used `name` — we fall back to it for
 * safety in case the schema ever shifts back.
 */
export async function resolveENSAddress(
  address: string,
): Promise<string | null> {
  try {
    const response = await fetch(`https://ensdata.net/${address}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return (
      data.ens_primary ||
      data.display ||
      data.ens ||
      data.name ||
      null
    );
  } catch (error) {
    console.warn("ENS reverse resolution failed:", error);
    return null;
  }
}

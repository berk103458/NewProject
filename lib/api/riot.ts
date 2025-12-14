/**
 * Riot Games API Client
 * 
 * NOT: Riot API key gerekli
 * .env.local'e ekle:
 * RIOT_API_KEY=your_riot_api_key
 * 
 * API Key almak için: https://developer.riotgames.com/
 */

const RIOT_API_BASE = {
  lol: {
    TR: "https://tr1.api.riotgames.com",
    EUW: "https://euw1.api.riotgames.com",
    EUNE: "https://eun1.api.riotgames.com",
    NA: "https://na1.api.riotgames.com",
  },
  valorant: "https://europe.api.riotgames.com",
};

export interface RiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}

export interface LoLSummoner {
  id: string;
  accountId: string;
  puuid: string;
  name: string;
  summonerLevel: number;
}

export interface LoLRank {
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
}

export interface ValorantAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}

export class RiotAPI {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // Helper: Get regional route for account API
  private getRegionalRoute(region: string): string {
    switch (region.toUpperCase()) {
      case "TR":
      case "EUW":
      case "EUNE":
        return "europe";
      case "NA":
        return "americas";
      case "AP":
      case "KR":
        return "asia";
      default:
        return "europe";
    }
  }

  // Helper: Get AP region route (for Valorant content API - uses ap.api.riotgames.com)
  private getAPRoute(): string {
    return "ap";
  }

  // Helper: Get Valorant shard from region (for internal API format)
  private getValorantShard(region: string): string {
    // Valorant shards based on region (from valapidocs.techchrism.me)
    const regionUpper = region.toUpperCase();
    if (regionUpper === "NA" || regionUpper === "BR" || regionUpper === "LATAM") {
      return "na";
    } else if (regionUpper === "EU" || regionUpper === "TR" || regionUpper === "EUW" || regionUpper === "EUNE") {
      return "eu";
    } else if (regionUpper === "AP") {
      return "ap";
    } else if (regionUpper === "KR") {
      return "kr";
    }
    return "eu"; // Default to EU
  }

  // LoL: Get account by Riot ID (uses regional routing)
  async getLoLAccountByRiotID(gameName: string, tagLine: string, region: string = "TR") {
    const regionalRoute = this.getRegionalRoute(region);
    const url = `https://${regionalRoute}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      throw new Error("Riot API key is empty or invalid");
    }

    const response = await fetch(url, {
      headers: {
        "X-Riot-Token": this.apiKey.trim(),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Riot API error: ${response.status}`;
      
      if (response.status === 403) {
        errorMessage += " - Forbidden. Possible causes:\n";
        errorMessage += "1. API key is invalid or expired\n";
        errorMessage += "2. API key doesn't have required permissions\n";
        errorMessage += "3. IP address is not whitelisted\n";
        errorMessage += "4. Development API key expired (24h limit)\n";
        errorMessage += `\nResponse: ${errorText}`;
      } else {
        errorMessage += ` - ${errorText}`;
      }
      
      throw new Error(errorMessage);
    }
    return response.json() as Promise<RiotAccount>;
  }

  // LoL: Get summoner by PUUID
  async getLoLSummonerByPUUID(puuid: string, region: string = "TR") {
    const baseUrl = RIOT_API_BASE.lol[region as keyof typeof RIOT_API_BASE.lol] || RIOT_API_BASE.lol.TR;
    const url = `${baseUrl}/lol/summoner/v4/summoners/by-puuid/${puuid}`;
    
    const response = await fetch(url, {
      headers: {
        "X-Riot-Token": this.apiKey.trim(),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Riot API error: ${response.status} - ${errorText}`);
    }
    return response.json() as Promise<LoLSummoner>;
  }

  // LoL: Get rank by summoner ID
  async getLoLRank(summonerId: string, region: string = "TR") {
    const baseUrl = RIOT_API_BASE.lol[region as keyof typeof RIOT_API_BASE.lol] || RIOT_API_BASE.lol.TR;
    const url = `${baseUrl}/lol/league/v4/entries/by-summoner/${summonerId}`;
    
    const response = await fetch(url, {
      headers: {
        "X-Riot-Token": this.apiKey.trim(),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Riot API error: ${response.status}`;
      
      if (response.status === 403) {
        errorMessage += " - Forbidden. Possible causes:\n";
        errorMessage += "1. API key doesn't have access to LoL rank endpoint\n";
        errorMessage += "2. Account is unranked (no rank data available)\n";
        errorMessage += "3. API key expired or invalid\n";
      } else if (response.status === 404) {
        // 404 means no rank data (unranked account) - this is normal
        return null;
      } else {
        errorMessage += ` - ${errorText}`;
      }
      
      throw new Error(errorMessage);
    }
    const ranks = await response.json() as LoLRank[];
    
    // If empty array, account is unranked
    if (!ranks || ranks.length === 0) {
      return null;
    }
    
    return ranks.find((r) => r.queueType === "RANKED_SOLO_5x5") || ranks[0];
  }

  // Valorant: Get account by Riot ID
  async getValorantAccountByRiotID(gameName: string, tagLine: string) {
    const url = `${RIOT_API_BASE.valorant}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    
    const response = await fetch(url, {
      headers: {
        "X-Riot-Token": this.apiKey.trim(),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Riot API error: ${response.status}`;
      
      if (response.status === 403) {
        errorMessage += " - Forbidden. Check API key validity and permissions.";
      } else {
        errorMessage += ` - ${errorText}`;
      }
      
      throw new Error(errorMessage);
    }
    return response.json() as Promise<ValorantAccount>;
  }

  // Valorant: Get MMR (Note: This endpoint may not be available in all regions or may require special permissions)
  async getValorantMMR(puuid: string, region: string = "TR") {
    const regionalRoute = this.getRegionalRoute(region);
    // Try the MMR endpoint - if it fails, we'll handle it gracefully
    const url = `https://${regionalRoute}.api.riotgames.com/val/ranked/v1/players/${puuid}`;
    
    const response = await fetch(url, {
      headers: {
        "X-Riot-Token": this.apiKey.trim(),
      },
    });

    if (!response.ok) {
      // If 403 or 404, the endpoint might not be available - return null instead of throwing
      if (response.status === 403 || response.status === 404) {
        console.warn(`Valorant MMR endpoint not available (${response.status}). This is normal for some API keys.`);
        return null;
      }
      const errorText = await response.text();
      throw new Error(`Riot API error: ${response.status} - ${errorText}`);
    }
    return response.json();
  }

  // LoL: Get match history by PUUID
  async getLoLMatchHistory(puuid: string, region: string = "TR", count: number = 20) {
    const regionalRoute = this.getRegionalRoute(region);
    const url = `https://${regionalRoute}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}`;
    
    const response = await fetch(url, {
      headers: {
        "X-Riot-Token": this.apiKey.trim(),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Riot API error: ${response.status} - ${errorText}`);
    }
    return response.json() as Promise<string[]>;
  }

  // LoL: Get match details by match ID
  async getLoLMatchDetails(matchId: string, region: string = "TR") {
    const regionalRoute = this.getRegionalRoute(region);
    const url = `https://${regionalRoute}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
    
    const response = await fetch(url, {
      headers: {
        "X-Riot-Token": this.apiKey.trim(),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Riot API error: ${response.status} - ${errorText}`);
    }
    return response.json();
  }

  // Valorant: Get match history by PUUID
  async getValorantMatchHistory(puuid: string, region: string = "TR", count: number = 20) {
    const regionalRoute = this.getRegionalRoute(region);
    
    // Valorant API endpoints - try different formats
    // Note: valapidocs.techchrism.me shows internal API format: pd.{shard}.a.pvp.net/match-history/v1/history/{puuid}
    // But that requires auth tokens. We try public Riot API endpoints first.
    const shard = this.getValorantShard(region);
    
    const endpoints = [
      // Endpoint 1: Public Riot API - Match list by PUUID (with query params)
      {
        url: `https://${regionalRoute}.api.riotgames.com/val/match/v1/matchlists/by-puuid/${puuid}?start=0&end=${count}`,
        name: "matchlists/by-puuid (public API)"
      },
      // Endpoint 2: Public Riot API - Match list by PUUID (without params)
      {
        url: `https://${regionalRoute}.api.riotgames.com/val/match/v1/matchlists/by-puuid/${puuid}`,
        name: "matchlists/by-puuid (public API, no params)"
      },
      // Endpoint 3: Public Riot API - Recent matches by queue (competitive)
      {
        url: `https://${regionalRoute}.api.riotgames.com/val/match/v1/recent-matches/by-queue/competitive/by-puuid/${puuid}`,
        name: "recent-matches/competitive (public API)"
      },
      // Endpoint 4: Public Riot API - Recent matches (all queues)
      {
        url: `https://${regionalRoute}.api.riotgames.com/val/match/v1/recent-matches/by-queue/all/by-puuid/${puuid}`,
        name: "recent-matches/all (public API)"
      },
      // Endpoint 5: Alternative format - Match history v1 (based on valapidocs format)
      {
        url: `https://${regionalRoute}.api.riotgames.com/val/match/v1/history/${puuid}?startIndex=0&endIndex=${count}`,
        name: "history/v1 (public API, valapidocs format)"
      },
      // Endpoint 6: Internal API format (may not work without auth tokens, but worth trying)
      {
        url: `https://pd.${shard}.a.pvp.net/match-history/v1/history/${puuid}?startIndex=0&endIndex=${count}`,
        name: "pd.{shard}.a.pvp.net (internal API format - requires auth)"
      },
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`Trying Valorant endpoint: ${endpoint.name} - ${endpoint.url}`);
        
        // Try both header and query parameter methods
        // Some endpoints might accept api_key as query parameter
        const urlWithKey = `${endpoint.url}${endpoint.url.includes('?') ? '&' : '?'}api_key=${this.apiKey.trim()}`;
        
        // First try with header (standard method)
        let response = await fetch(endpoint.url, {
          headers: {
            "X-Riot-Token": this.apiKey.trim(),
          },
        });
        
        let responseStatus = response.status;
        let responseBody: string | null = null;

        // If 403, try with query parameter (some endpoints might require this)
        if (response.status === 403) {
          console.log(`403 received, trying with query parameter: ${endpoint.name}`);
          // Clone response before reading body
          responseBody = await response.clone().text();
          console.log(`403 Error details for ${endpoint.name}:`, responseBody);
          
          // Try with query parameter
          response = await fetch(urlWithKey, {
            headers: {
              "X-Riot-Token": this.apiKey.trim(),
            },
          });
          responseStatus = response.status;
          
          // If still 403, log the new response
          if (responseStatus === 403) {
            responseBody = await response.clone().text();
            console.log(`403 Error details (with query param) for ${endpoint.name}:`, responseBody);
          }
        }

        console.log(`Response status: ${responseStatus} for ${endpoint.name}`);
        
        // Log response body for debugging if still 403 after query parameter attempt
        if (responseStatus === 403 && !responseBody) {
          responseBody = await response.clone().text();
          console.log(`403 Error details for ${endpoint.name}:`, responseBody);
        }

        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Valorant match history endpoint success: ${endpoint.name}`, JSON.stringify(data, null, 2));
          
          // Handle different response formats
          // Format 1: { History: [{ MatchID, GameStartTime, QueueID }] } - from valapidocs.techchrism.me
          if (data.History && Array.isArray(data.History)) {
            const matches = data.History.map((match: any) => match.MatchID || match.matchId || match);
            console.log(`Found ${matches.length} matches in History array (valapidocs format)`);
            return { history: matches.slice(0, count) };
          }
          // Format 2: { history: [...] }
          else if (data.history && Array.isArray(data.history)) {
            const matches = data.history.map((match: any) => typeof match === "string" ? match : (match.MatchID || match.matchId || match));
            console.log(`Found ${matches.length} matches in history array`);
            return { history: matches.slice(0, count) };
          }
          // Format 3: Direct array
          else if (Array.isArray(data)) {
            const matches = data.map((match: any) => typeof match === "string" ? match : (match.MatchID || match.matchId || match));
            console.log(`Found ${data.length} matches in array format`);
            return { history: matches.slice(0, count) };
          }
          // Format 4: { matchIds: [...] }
          else if (data.matchIds && Array.isArray(data.matchIds)) {
            console.log(`Found ${data.matchIds.length} match IDs`);
            return { history: data.matchIds.slice(0, count) };
          }
          // Format 5: { matches: [...] }
          else if (data.matches && Array.isArray(data.matches)) {
            const matches = data.matches.map((match: any) => typeof match === "string" ? match : (match.MatchID || match.matchId || match));
            console.log(`Found ${data.matches.length} matches`);
            return { history: matches.slice(0, count) };
          } else {
            console.warn(`Unexpected response format from ${endpoint.name}:`, JSON.stringify(data, null, 2));
          }
            } else {
              // Don't read body again if we already read it
              if (!responseBody) {
                responseBody = await response.clone().text();
              }
              console.warn(`❌ Endpoint ${endpoint.name} failed with status ${responseStatus}:`, responseBody);
              
              // If 404, it might mean no matches, not an error
              if (responseStatus === 404) {
                console.log(`404 from ${endpoint.name} - likely no matches found`);
                continue;
              }
            }
      } catch (error: any) {
        console.warn(`❌ Error trying ${endpoint.name}:`, error.message);
        continue;
      }
    }

    // If all endpoints fail, return empty
    console.warn("⚠️ All Valorant match history endpoints failed - API key may not have access to Valorant match history");
    return { history: [] };
  }

  // Valorant: Get match details by match ID
  async getValorantMatchDetails(matchId: string, region: string = "TR") {
    const regionalRoute = this.getRegionalRoute(region);
    const url = `https://${regionalRoute}.api.riotgames.com/val/match/v1/matches/${matchId}`;
    
    const response = await fetch(url, {
      headers: {
        "X-Riot-Token": this.apiKey.trim(),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Riot API error: ${response.status} - ${errorText}`);
    }
    return response.json();
  }
}

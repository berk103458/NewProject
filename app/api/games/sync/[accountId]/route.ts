import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { RiotAPI } from "@/lib/api/riot";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await params;
    const supabase = createAdminClient();
    const riotApiKey = process.env.RIOT_API_KEY?.trim();

    if (!riotApiKey) {
      console.error("RIOT_API_KEY is not set in environment variables");
      return NextResponse.json(
        { error: "Riot API key not configured. Please add RIOT_API_KEY to .env.local" },
        { status: 500 }
      );
    }

    // Log API key length for debugging (don't log the actual key)
    console.log(`Riot API key length: ${riotApiKey.length} characters`);

    // Get game account
    const { data: account, error: accountError } = await supabase
      .from("game_accounts")
      .select("*, games(slug)")
      .eq("id", accountId)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    const riotAPI = new RiotAPI(riotApiKey);
    const gameSlug = (account.games as any).slug;

    // Sync based on game type
    if (gameSlug === "lol") {
      // Get Riot account by Riot ID
      const riotAccount = await riotAPI.getLoLAccountByRiotID(
        account.game_username,
        account.game_tag || "",
        account.region || "TR"
      );

      // Get summoner by PUUID
      const summoner = await riotAPI.getLoLSummonerByPUUID(riotAccount.puuid, account.region || "TR");

      // Get rank (optional - may fail for unranked accounts or API key limitations)
      let rank = null;
      try {
        rank = await riotAPI.getLoLRank(summoner.id, account.region || "TR");
      } catch (error: any) {
        console.warn("Could not fetch LoL rank (this is normal for unranked accounts or API limitations):", error.message);
        // Continue without rank data
      }

      // Update game account
      const updateData: any = {
        rank: rank?.tier || null,
        tier: rank?.rank || null,
        level: summoner.summonerLevel,
        is_verified: true,
        last_synced_at: new Date().toISOString(),
      };

      // Add platform_id if available (only if column exists)
      if (riotAccount.puuid) {
        updateData.platform_id = riotAccount.puuid;
      }

      // Add lp if available (only if column exists)
      if (rank?.leaguePoints !== undefined) {
        updateData.lp = rank.leaguePoints;
      }

      const { error: updateError } = await supabase
        .from("game_accounts")
        .update(updateData)
        .eq("id", accountId);

      if (updateError) throw updateError;

      // Fetch match history
      let matchHistory: string[] = [];
      try {
        matchHistory = await riotAPI.getLoLMatchHistory(riotAccount.puuid, account.region || "TR", 20);
        console.log(`Found ${matchHistory.length} LoL matches`);
      } catch (error: any) {
        console.warn("Could not fetch LoL match history:", error.message);
      }

      // Process matches and calculate detailed statistics
      let totalKills = 0;
      let totalDeaths = 0;
      let totalAssists = 0;
      let totalFarm = 0;
      let totalDamage = 0;
      let wins = 0;
      let losses = 0;
      const recentMatches: any[] = [];
      const championCounts: Record<string, number> = {};

      // Process each match
      for (const matchId of matchHistory.slice(0, 20)) {
        try {
          const matchDetails = await riotAPI.getLoLMatchDetails(matchId, account.region || "TR");
          const participant = matchDetails.info.participants.find((p: any) => p.puuid === riotAccount.puuid);
          
          if (participant) {
            const isWin = participant.win;
            if (isWin) wins++;
            else losses++;

            totalKills += participant.kills;
            totalDeaths += participant.deaths;
            totalAssists += participant.assists;
            totalFarm += participant.totalMinionsKilled + participant.neutralMinionsKilled;
            totalDamage += participant.totalDamageDealtToChampions;

            // Track champion usage
            if (participant.championName) {
              championCounts[participant.championName] = (championCounts[participant.championName] || 0) + 1;
            }

            // Store match for recent_matches table
            recentMatches.push({
              game_account_id: accountId,
              match_id: matchId,
              game_mode: matchDetails.info.gameMode,
              champion: participant.championName,
              role: participant.teamPosition || participant.lane,
              result: isWin ? "win" : "loss",
              kills: participant.kills,
              deaths: participant.deaths,
              assists: participant.assists,
              farm: participant.totalMinionsKilled + participant.neutralMinionsKilled,
              damage: participant.totalDamageDealtToChampions,
              match_duration: matchDetails.info.gameDuration,
              match_date: new Date(matchDetails.info.gameStartTimestamp).toISOString(),
            });
          }
        } catch (error: any) {
          console.warn(`Error processing match ${matchId}:`, error.message);
        }
      }

      // Calculate statistics
      const totalGames = wins + losses;
      const winrate = totalGames > 0 ? (wins / totalGames) * 100 : 0;
      const kda = totalDeaths > 0 ? (totalKills + totalAssists) / totalDeaths : (totalKills + totalAssists) > 0 ? 999 : 0;
      const avgFarm = totalGames > 0 ? totalFarm / totalGames : 0;
      const avgDamage = totalGames > 0 ? totalDamage / totalGames : 0;
      const favoriteChampion = Object.keys(championCounts).length > 0
        ? Object.keys(championCounts).reduce((a, b) => 
            championCounts[a] > championCounts[b] ? a : b
          )
        : null;

      // Use rank data if no matches found (only if rank data is available)
      const finalTotalGames = totalGames > 0 ? totalGames : (rank ? (rank.wins + rank.losses) : 0);
      const finalWins = wins > 0 ? wins : (rank ? rank.wins : 0);
      const finalLosses = losses > 0 ? losses : (rank ? rank.losses : 0);
      const finalWinrate = finalTotalGames > 0 ? (finalWins / finalTotalGames) * 100 : 0;

      // Update statistics - always upsert even if no matches
      const statsPayload: any = {
        game_account_id: accountId,
        season: "2024",
        total_games: finalTotalGames,
        wins: finalWins,
        losses: finalLosses,
        winrate: finalWinrate,
        total_kills: totalKills,
        total_deaths: totalDeaths,
        total_assists: totalAssists,
        kda: kda,
        avg_farm: Math.round(avgFarm),
        avg_damage: Math.round(avgDamage),
        favorite_champion: favoriteChampion,
        last_match_date: recentMatches.length > 0 ? recentMatches[0].match_date : null,
      };

      console.log("Upserting LoL statistics payload:", statsPayload);

      const { data: upsertedData, error: statsError } = await supabase
        .from("game_statistics")
        .upsert(statsPayload, {
          onConflict: "game_account_id, season",
        })
        .select();

      if (statsError) {
        console.error("Error upserting statistics:", statsError);
        throw statsError;
      }

      console.log("LoL Statistics updated successfully:", {
        upserted: upsertedData,
        totalGames: finalTotalGames,
        wins: finalWins,
        losses: finalLosses,
        winrate: finalWinrate.toFixed(2) + "%",
      });

      // Clear old matches and insert new ones
      await supabase.from("recent_matches").delete().eq("game_account_id", accountId);
      
      if (recentMatches.length > 0) {
        const { data: insertedMatches, error: matchesError } = await supabase
          .from("recent_matches")
          .insert(recentMatches)
          .select("id, match_id");

        if (matchesError) {
          console.warn("Error inserting matches:", matchesError);
        } else {
          // Insert teammates for each match
          for (let i = 0; i < matchHistory.length && i < recentMatches.length; i++) {
            try {
              const matchDetails = await riotAPI.getLoLMatchDetails(matchHistory[i], account.region || "TR");
              const participant = matchDetails.info.participants.find((p: any) => p.puuid === riotAccount.puuid);
              
              if (participant && insertedMatches?.[i]) {
                const teammates: any[] = [];
                for (const p of matchDetails.info.participants) {
                  if (p.puuid !== riotAccount.puuid && p.teamId === participant.teamId) {
                    teammates.push({
                      match_id: insertedMatches[i].id,
                      teammate_username: p.riotIdGameName || p.summonerName,
                      teammate_tag: p.riotIdTagline || null,
                      was_ally: true,
                    });
                  }
                }
                if (teammates.length > 0) {
                  await supabase.from("match_teammates").insert(teammates);
                }
              }
            } catch (error) {
              // Skip teammate insertion if match details fail
            }
          }
        }
      }
    } else if (gameSlug === "valorant") {
      // Get Valorant account
      const valorantAccount = await riotAPI.getValorantAccountByRiotID(
        account.game_username,
        account.game_tag || ""
      );

      // Try to get MMR (may not be available for all API keys - this is optional)
      let mmr = null;
      try {
        mmr = await riotAPI.getValorantMMR(valorantAccount.puuid, account.region || "TR");
        console.log("Valorant MMR retrieved successfully");
      } catch (error: any) {
        // If MMR endpoint fails (403, 404, etc.), continue without it
        // This is normal - not all API keys have access to Valorant MMR endpoint
        console.warn("Valorant MMR not available (this is normal for some API keys):", error.message);
      }

      // Fetch match history
      let matchHistory: any = null;
      try {
        console.log(`Fetching Valorant match history for PUUID: ${valorantAccount.puuid}`);
        matchHistory = await riotAPI.getValorantMatchHistory(valorantAccount.puuid, account.region || "TR", 20);
        console.log(`Valorant match history result:`, matchHistory);
      } catch (error: any) {
        console.error("Error fetching Valorant match history:", error.message);
        matchHistory = { history: [] };
      }

      // Process matches and calculate detailed statistics
      let totalKills = 0;
      let totalDeaths = 0;
      let totalAssists = 0;
      let totalDamage = 0;
      let wins = 0;
      let losses = 0;
      const recentMatches: any[] = [];
      const agentCounts: Record<string, number> = {};

      // Process match history if available
      console.log("Valorant match history data:", matchHistory);
      
      if (matchHistory?.history && matchHistory.history.length > 0) {
        console.log(`Processing ${matchHistory.history.length} Valorant matches`);
        
        for (const matchInfo of matchHistory.history.slice(0, 20)) {
          try {
            // Match info can be string (matchId) or object with matchId property
            const matchId = typeof matchInfo === "string" ? matchInfo : (matchInfo.matchId || matchInfo);
            if (!matchId) {
              console.warn("Skipping match - no matchId:", matchInfo);
              continue;
            }
            
            console.log(`Fetching Valorant match details for: ${matchId}`);
            const matchDetails = await riotAPI.getValorantMatchDetails(matchId, account.region || "TR");
            const player = matchDetails.players?.all_players?.find((p: any) => p.puuid === valorantAccount.puuid);
            
            if (player) {
              const playerTeam = player.team;
              const teamStats = matchDetails.teams?.find((t: any) => t.teamId === playerTeam);
              const isWin = teamStats?.won || false;

              if (isWin) wins++;
              else losses++;

              const stats = player.stats || {};
              totalKills += stats.kills || 0;
              totalDeaths += stats.deaths || 0;
              totalAssists += stats.assists || 0;
              totalDamage += stats.damage?.made || 0;

              // Track agent usage
              if (player.character) {
                agentCounts[player.character] = (agentCounts[player.character] || 0) + 1;
              }

              // Store match
              recentMatches.push({
                game_account_id: accountId,
                match_id: matchId,
                game_mode: matchDetails.metadata?.mode || "Competitive",
                agent: player.character,
                result: isWin ? "win" : "loss",
                kills: stats.kills || 0,
                deaths: stats.deaths || 0,
                assists: stats.assists || 0,
                damage: stats.damage?.made || 0,
                match_duration: matchDetails.metadata?.game_length || 0,
                match_date: new Date(matchDetails.metadata?.game_start_patched || Date.now()).toISOString(),
              });
            } else {
              console.warn(`Player not found in match ${matchId}`);
            }
          } catch (error: any) {
            console.warn(`Error processing Valorant match:`, error.message);
          }
        }
      } else {
        console.warn("⚠️ No Valorant match history available - statistics will be 0");
        console.warn("💡 Note: Valorant match history requires Riot API production key.");
        console.warn("💡 Development keys don't have access to Valorant match history endpoints.");
        console.warn("💡 Account information (rank, level) is still saved.");
      }

      // Calculate statistics
      const totalGames = wins + losses;
      const winrate = totalGames > 0 ? (wins / totalGames) * 100 : 0;
      const kda = totalDeaths > 0 ? (totalKills + totalAssists) / totalDeaths : (totalKills + totalAssists) > 0 ? 999 : 0;
      const avgDamage = totalGames > 0 ? totalDamage / totalGames : 0;
      const favoriteAgent = Object.keys(agentCounts).length > 0
        ? Object.keys(agentCounts).reduce((a, b) => 
            agentCounts[a] > agentCounts[b] ? a : b
          )
        : null;

      console.log("Valorant statistics calculated:", {
        totalGames,
        wins,
        losses,
        totalKills,
        totalDeaths,
        totalAssists,
        winrate: winrate.toFixed(2) + "%",
        kda: kda.toFixed(2),
        avgDamage: Math.round(avgDamage),
        favoriteAgent,
        recentMatchesCount: recentMatches.length,
      });

      // Update account
      const updateData: any = {
        is_verified: true,
        last_synced_at: new Date().toISOString(),
      };

      // Only add platform_id if it exists in the schema
      if (valorantAccount.puuid) {
        updateData.platform_id = valorantAccount.puuid;
      }

      const { error: updateError } = await supabase
        .from("game_accounts")
        .update(updateData)
        .eq("id", accountId);

      if (updateError) throw updateError;

      // Update statistics - always upsert even if no matches (at least save 0 values)
      const statsPayload: any = {
        game_account_id: accountId,
        season: "2024",
        total_games: totalGames,
        wins: wins,
        losses: losses,
        winrate: winrate,
        total_kills: totalKills,
        total_deaths: totalDeaths,
        total_assists: totalAssists,
        kda: kda,
        avg_damage: Math.round(avgDamage),
        favorite_agent: favoriteAgent,
        last_match_date: recentMatches.length > 0 ? recentMatches[0].match_date : null,
      };

      console.log("Upserting Valorant statistics payload:", statsPayload);

      const { data: upsertedData, error: statsError } = await supabase
        .from("game_statistics")
        .upsert(statsPayload, {
          onConflict: "game_account_id, season",
        })
        .select();

      if (statsError) {
        console.error("Error upserting Valorant statistics:", statsError);
        throw statsError;
      }

      console.log("Valorant statistics updated successfully:", {
        upserted: upsertedData,
        totalGames,
        wins,
        losses,
        winrate: winrate.toFixed(2) + "%",
      });

      // Clear old matches and insert new ones
      await supabase.from("recent_matches").delete().eq("game_account_id", accountId);
      
      if (recentMatches.length > 0) {
        const { data: insertedMatches, error: matchesError } = await supabase
          .from("recent_matches")
          .insert(recentMatches)
          .select("id");

        if (matchesError) {
          console.warn("Error inserting Valorant matches:", matchesError);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: error.message || "Sync failed" },
      { status: 500 }
    );
  }
}

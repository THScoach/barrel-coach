/**
 * Browserbase-Reboot Automation
 * 
 * Automates Reboot Motion dashboard operations via Browserbase:
 * 1. Logs into Reboot Motion dashboard
 * 2. Creates player if needed
 * 3. Uploads swing videos
 * 4. Waits for processing
 * 5. Downloads analysis data
 * 
 * Uses Browserbase's HTTP API for browser control since we can't run
 * Puppeteer directly in Deno edge functions.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BROWSERBASE_API = "https://api.browserbase.com/v1";
const REBOOT_DASHBOARD_URL = "https://dashboard.rebootmotion.com";

interface BrowserbaseSession {
  id: string;
  status: string;
  connectUrl: string;
  debuggerUrl?: string;
}

interface AutomationRequest {
  action: "upload_video" | "create_player" | "download_data" | "full_pipeline" | "test_login" | "find_player" | "pull_reports";
  player_id?: string;
  player_name?: string;
  player_email?: string;
  reboot_player_id?: string;
  video_url?: string;
  video_storage_path?: string;
  session_id?: string;
  callback_phone?: string;
  is_whatsapp?: boolean;
}

interface AutomationResult {
  success: boolean;
  message: string;
  data?: any;
  sessionId?: string;
  replayUrl?: string;
  errors?: string[];
}

/**
 * Create a new Browserbase session
 */
async function createBrowserSession(apiKey: string, projectId: string): Promise<BrowserbaseSession> {
  console.log("[Browserbase] Creating new session...");
  
  const response = await fetch(`${BROWSERBASE_API}/sessions`, {
    method: "POST",
    headers: {
      "X-BB-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId,
      browserSettings: {
        fingerprint: {
          browsers: ["chrome"],
          devices: ["desktop"],
          operatingSystems: ["windows"],
        },
      },
      keepAlive: true,
      timeout: 300, // 5 minutes in seconds
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[Browserbase] Session creation failed:", response.status, error);
    throw new Error(`Failed to create Browserbase session: ${response.status}`);
  }

  const session = await response.json();
  console.log(`[Browserbase] Session created: ${session.id}`);
  
  return {
    id: session.id,
    status: session.status,
    connectUrl: session.connectUrl,
    debuggerUrl: session.debuggerUrl,
  };
}

/**
 * Execute a script in the browser session via CDP
 */
async function executeScript(
  apiKey: string,
  sessionId: string,
  script: string
): Promise<any> {
  const response = await fetch(`${BROWSERBASE_API}/sessions/${sessionId}/execute`, {
    method: "POST",
    headers: {
      "X-BB-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      script,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Script execution failed: ${error}`);
  }

  return response.json();
}

/**
 * Navigate to a URL in the browser session
 */
async function navigateTo(
  apiKey: string,
  sessionId: string,
  url: string
): Promise<void> {
  console.log(`[Browserbase] Navigating to: ${url}`);
  
  const script = `
    await page.goto("${url}", { waitUntil: "networkidle2", timeout: 60000 });
    return { url: page.url(), title: await page.title() };
  `;
  
  const result = await executeScript(apiKey, sessionId, script);
  console.log(`[Browserbase] Navigated:`, result);
}

/**
 * Login to Reboot Motion dashboard
 */
async function loginToReboot(
  apiKey: string,
  sessionId: string,
  username: string,
  password: string
): Promise<boolean> {
  console.log("[Browserbase] Logging into Reboot Motion...");
  
  const loginScript = `
    // Navigate to login page
    await page.goto("${REBOOT_DASHBOARD_URL}/login", { waitUntil: "networkidle2", timeout: 60000 });
    
    // Wait for login form
    await page.waitForSelector('input[type="email"], input[name="email"], input[placeholder*="email"]', { timeout: 10000 });
    
    // Fill credentials
    const emailInput = await page.$('input[type="email"], input[name="email"], input[placeholder*="email"]');
    if (emailInput) {
      await emailInput.type("${username}");
    }
    
    const passwordInput = await page.$('input[type="password"]');
    if (passwordInput) {
      await passwordInput.type("${password}");
    }
    
    // Click login button
    const loginButton = await page.$('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")');
    if (loginButton) {
      await loginButton.click();
    }
    
    // Wait for navigation
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 });
    
    // Check if login successful (should not be on login page)
    const currentUrl = page.url();
    const isLoggedIn = !currentUrl.includes("/login");
    
    return { loggedIn: isLoggedIn, url: currentUrl };
  `;
  
  try {
    const result = await executeScript(apiKey, sessionId, loginScript);
    console.log("[Browserbase] Login result:", result);
    return result.loggedIn === true;
  } catch (error) {
    console.error("[Browserbase] Login error:", error);
    return false;
  }
}

/**
 * Check if player exists in Reboot Motion
 */
async function findPlayerInReboot(
  apiKey: string,
  sessionId: string,
  playerName: string
): Promise<{ exists: boolean; playerId?: string }> {
  console.log(`[Browserbase] Searching for player: ${playerName}`);
  
  const searchScript = `
    // Navigate to players/athletes page
    await page.goto("${REBOOT_DASHBOARD_URL}/athletes", { waitUntil: "networkidle2", timeout: 30000 });
    
    // Wait for page load
    await page.waitForSelector('[data-testid="athletes-list"], .athletes-list, table', { timeout: 10000 });
    
    // Search for player
    const searchInput = await page.$('input[type="search"], input[placeholder*="search"], input[placeholder*="Search"]');
    if (searchInput) {
      await searchInput.type("${playerName}");
      await page.waitForTimeout(2000); // Wait for search results
    }
    
    // Look for player in results
    const playerLinks = await page.$$('a[href*="/athlete/"], a[href*="/player/"]');
    let foundPlayerId = null;
    
    for (const link of playerLinks) {
      const text = await link.innerText();
      if (text.toLowerCase().includes("${playerName.toLowerCase()}")) {
        const href = await link.getAttribute("href");
        const match = href?.match(/\\/(?:athlete|player)\\/([a-f0-9-]+)/);
        if (match) {
          foundPlayerId = match[1];
          break;
        }
      }
    }
    
    return { exists: !!foundPlayerId, playerId: foundPlayerId };
  `;
  
  try {
    const result = await executeScript(apiKey, sessionId, searchScript);
    return result;
  } catch (error) {
    console.error("[Browserbase] Player search error:", error);
    return { exists: false };
  }
}

/**
 * Create a new player in Reboot Motion
 */
async function createPlayerInReboot(
  apiKey: string,
  sessionId: string,
  playerName: string,
  playerEmail?: string
): Promise<{ created: boolean; playerId?: string }> {
  console.log(`[Browserbase] Creating player: ${playerName}`);
  
  const createScript = `
    // Navigate to create player page
    await page.goto("${REBOOT_DASHBOARD_URL}/athletes/new", { waitUntil: "networkidle2", timeout: 30000 });
    
    // Fill in player details
    const nameInput = await page.$('input[name="name"], input[placeholder*="name"], input[id*="name"]');
    if (nameInput) {
      await nameInput.type("${playerName}");
    }
    
    ${playerEmail ? `
    const emailInput = await page.$('input[name="email"], input[type="email"]');
    if (emailInput) {
      await emailInput.type("${playerEmail}");
    }
    ` : ""}
    
    // Submit form
    const submitButton = await page.$('button[type="submit"], button:has-text("Create"), button:has-text("Save")');
    if (submitButton) {
      await submitButton.click();
    }
    
    // Wait for creation
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 });
    
    // Get new player ID from URL
    const currentUrl = page.url();
    const match = currentUrl.match(/\\/(?:athlete|player)\\/([a-f0-9-]+)/);
    
    return { created: !!match, playerId: match?.[1] || null, url: currentUrl };
  `;
  
  try {
    const result = await executeScript(apiKey, sessionId, createScript);
    console.log("[Browserbase] Create player result:", result);
    return { created: result.created, playerId: result.playerId };
  } catch (error) {
    console.error("[Browserbase] Create player error:", error);
    return { created: false };
  }
}

/**
 * Upload a video to a player's profile
 */
async function uploadVideoToReboot(
  apiKey: string,
  sessionId: string,
  playerId: string,
  videoUrl: string
): Promise<{ uploaded: boolean; rebootSessionId?: string }> {
  console.log(`[Browserbase] Uploading video for player: ${playerId}`);
  
  // First download the video, then upload it
  const uploadScript = `
    // Navigate to player's upload page
    await page.goto("${REBOOT_DASHBOARD_URL}/athlete/${playerId}/upload", { waitUntil: "networkidle2", timeout: 30000 });
    
    // Wait for upload interface
    await page.waitForSelector('input[type="file"], .dropzone, [data-testid="upload-area"]', { timeout: 10000 });
    
    // Download video from our storage and upload
    const response = await fetch("${videoUrl}");
    const blob = await response.blob();
    
    // Create a file from the blob
    const file = new File([blob], "swing.mp4", { type: "video/mp4" });
    
    // Find file input and upload
    const fileInput = await page.$('input[type="file"]');
    if (fileInput) {
      // Use the page.setInputFiles method for file uploads
      await fileInput.uploadFile(file);
    }
    
    // Wait for upload to complete
    await page.waitForSelector('.upload-complete, .success, [data-status="complete"]', { timeout: 120000 });
    
    // Get session ID from the page or URL
    const currentUrl = page.url();
    const match = currentUrl.match(/\\/session\\/([a-f0-9-]+)/);
    
    return { uploaded: true, sessionId: match?.[1] || null };
  `;
  
  try {
    const result = await executeScript(apiKey, sessionId, uploadScript);
    console.log("[Browserbase] Upload result:", result);
    return { uploaded: result.uploaded, rebootSessionId: result.sessionId };
  } catch (error) {
    console.error("[Browserbase] Upload error:", error);
    return { uploaded: false };
  }
}

/**
 * Wait for session processing and download data
 */
async function waitAndDownloadData(
  apiKey: string,
  sessionId: string,
  rebootSessionId: string
): Promise<{ success: boolean; downloadUrl?: string; error?: string }> {
  console.log(`[Browserbase] Waiting for session ${rebootSessionId} to process...`);
  
  const downloadScript = `
    // Navigate to session page
    await page.goto("${REBOOT_DASHBOARD_URL}/session/${rebootSessionId}", { waitUntil: "networkidle2", timeout: 30000 });
    
    // Poll for processing completion
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes (10s intervals)
    
    while (attempts < maxAttempts) {
      const status = await page.$eval('[data-testid="session-status"], .session-status', el => el.textContent);
      
      if (status?.toLowerCase().includes("complete") || status?.toLowerCase().includes("processed")) {
        break;
      }
      
      if (status?.toLowerCase().includes("failed") || status?.toLowerCase().includes("error")) {
        return { success: false, error: "Processing failed" };
      }
      
      await page.waitForTimeout(10000); // Wait 10 seconds
      await page.reload({ waitUntil: "networkidle2" });
      attempts++;
    }
    
    if (attempts >= maxAttempts) {
      return { success: false, error: "Processing timeout" };
    }
    
    // Click export/download button
    const exportButton = await page.$('button:has-text("Export"), button:has-text("Download"), a[href*="export"]');
    if (exportButton) {
      await exportButton.click();
    }
    
    // Wait for download modal/options
    await page.waitForSelector('.export-options, .download-options, [data-testid="export-modal"]', { timeout: 10000 });
    
    // Select CSV format
    const csvOption = await page.$('input[value="csv"], button:has-text("CSV"), [data-format="csv"]');
    if (csvOption) {
      await csvOption.click();
    }
    
    // Get the download URL
    const downloadLink = await page.$('a[download], a[href*=".csv"]');
    const downloadUrl = downloadLink ? await downloadLink.getAttribute("href") : null;
    
    return { success: true, downloadUrl };
  `;
  
  try {
    const result = await executeScript(apiKey, sessionId, downloadScript);
    return result;
  } catch (error) {
    console.error("[Browserbase] Download error:", error);
    return { success: false };
  }
}

/**
 * Close browser session
 */
async function closeSession(apiKey: string, sessionId: string): Promise<void> {
  console.log(`[Browserbase] Closing session: ${sessionId}`);
  
  try {
    await fetch(`${BROWSERBASE_API}/sessions/${sessionId}`, {
      method: "DELETE",
      headers: {
        "X-BB-API-Key": apiKey,
      },
    });
  } catch (error) {
    console.error("[Browserbase] Error closing session:", error);
  }
}

/**
 * Full automation pipeline: Upload video → Wait for processing → Download data → Run 4B
 */
async function runFullPipeline(
  supabase: any,
  apiKey: string,
  projectId: string,
  request: AutomationRequest
): Promise<AutomationResult> {
  const errors: string[] = [];
  let browserSession: BrowserbaseSession | null = null;
  
  try {
    // Get Reboot credentials
    const REBOOT_EMAIL = Deno.env.get("REBOOT_EMAIL");
    const REBOOT_PASSWORD = Deno.env.get("REBOOT_PASSWORD");
    
    if (!REBOOT_EMAIL || !REBOOT_PASSWORD) {
      return { success: false, message: "Reboot credentials not configured", errors: ["Missing REBOOT_EMAIL or REBOOT_PASSWORD"] };
    }
    
    // Get player info
    let playerId = request.player_id;
    let playerName = request.player_name;
    let playerEmail = request.player_email;
    
    if (playerId && !playerName) {
      const { data: player } = await supabase
        .from("players")
        .select("name, email, reboot_athlete_id, reboot_player_id")
        .eq("id", playerId)
        .single();
      
      if (player) {
        playerName = player.name;
        playerEmail = player.email;
      }
    }
    
    if (!playerName) {
      return { success: false, message: "Player name required", errors: ["No player_name provided"] };
    }
    
    if (!request.video_url) {
      return { success: false, message: "Video URL required", errors: ["No video_url provided"] };
    }
    
    // Create browser session
    browserSession = await createBrowserSession(apiKey, projectId);
    console.log(`[Pipeline] Browser session created: ${browserSession.id}`);
    
    // Login to Reboot
    const loggedIn = await loginToReboot(apiKey, browserSession.id, REBOOT_EMAIL, REBOOT_PASSWORD);
    if (!loggedIn) {
      errors.push("Failed to login to Reboot Motion");
      return { 
        success: false, 
        message: "Login failed", 
        errors,
        sessionId: browserSession.id,
        replayUrl: `https://browserbase.com/sessions/${browserSession.id}`
      };
    }
    
    // Check if player exists
    const playerSearch = await findPlayerInReboot(apiKey, browserSession.id, playerName);
    let rebootPlayerId = playerSearch.playerId;
    
    if (!playerSearch.exists) {
      // Create player
      const createResult = await createPlayerInReboot(apiKey, browserSession.id, playerName, playerEmail);
      if (!createResult.created) {
        errors.push("Failed to create player in Reboot");
        return { 
          success: false, 
          message: "Player creation failed", 
          errors,
          sessionId: browserSession.id,
          replayUrl: `https://browserbase.com/sessions/${browserSession.id}`
        };
      }
      rebootPlayerId = createResult.playerId;
      
      // Update player record with Reboot ID
      if (playerId && rebootPlayerId) {
        await supabase
          .from("players")
          .update({ reboot_athlete_id: rebootPlayerId })
          .eq("id", playerId);
      }
    }
    
    if (!rebootPlayerId) {
      return { success: false, message: "Could not find/create player in Reboot", errors };
    }
    
    // Upload video
    const uploadResult = await uploadVideoToReboot(apiKey, browserSession.id, rebootPlayerId, request.video_url);
    if (!uploadResult.uploaded) {
      errors.push("Failed to upload video");
      return { 
        success: false, 
        message: "Video upload failed", 
        errors,
        sessionId: browserSession.id,
        replayUrl: `https://browserbase.com/sessions/${browserSession.id}`
      };
    }
    
    const rebootSessionId = uploadResult.rebootSessionId;
    
    // Wait for processing and download data
    if (rebootSessionId) {
      const downloadResult = await waitAndDownloadData(apiKey, browserSession.id, rebootSessionId);
      
      if (downloadResult.success && downloadResult.downloadUrl) {
        // Process the downloaded CSV through our 4B engine
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        
        const processResponse = await fetch(`${supabaseUrl}/functions/v1/process-reboot-session`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            session_id: rebootSessionId,
            org_player_id: rebootPlayerId,
            player_id: playerId,
          }),
        });
        
        if (processResponse.ok) {
          const processResult = await processResponse.json();
          
          // Notify ClawdBot to respond to player
          if (request.callback_phone) {
            await fetch(`${supabaseUrl}/functions/v1/send-analysis-complete`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${supabaseServiceKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                player_id: playerId,
                phone: request.callback_phone,
                is_whatsapp: request.is_whatsapp,
                scores: processResult.scores,
                session_id: rebootSessionId,
              }),
            });
          }
          
          return {
            success: true,
            message: "Video processed and 4B scores calculated",
            data: processResult,
            sessionId: browserSession.id,
            replayUrl: `https://browserbase.com/sessions/${browserSession.id}`,
          };
        }
      }
    }
    
    return {
      success: true,
      message: "Video uploaded, waiting for Reboot processing",
      data: { rebootSessionId, rebootPlayerId },
      sessionId: browserSession.id,
      replayUrl: `https://browserbase.com/sessions/${browserSession.id}`,
    };
    
  } catch (error) {
    console.error("[Pipeline] Error:", error);
    errors.push(error instanceof Error ? error.message : "Unknown error");
    
    return {
      success: false,
      message: "Pipeline failed",
      errors,
      sessionId: browserSession?.id,
      replayUrl: browserSession?.id ? `https://browserbase.com/sessions/${browserSession.id}` : undefined,
    };
  } finally {
    // Always close the session
    if (browserSession) {
      await closeSession(apiKey, browserSession.id);
    }
  }
}

/**
 * Test login only - for verifying credentials work
 */
async function testLoginOnly(
  apiKey: string,
  projectId: string
): Promise<AutomationResult> {
  let browserSession: BrowserbaseSession | null = null;
  
  try {
    const REBOOT_EMAIL = Deno.env.get("REBOOT_EMAIL");
    const REBOOT_PASSWORD = Deno.env.get("REBOOT_PASSWORD");
    
    if (!REBOOT_EMAIL || !REBOOT_PASSWORD) {
      return { success: false, message: "Reboot credentials not configured", errors: ["Missing REBOOT_EMAIL or REBOOT_PASSWORD"] };
    }
    
    console.log("[TestLogin] Creating browser session...");
    browserSession = await createBrowserSession(apiKey, projectId);
    console.log(`[TestLogin] Session created: ${browserSession.id}`);
    
    const loggedIn = await loginToReboot(apiKey, browserSession.id, REBOOT_EMAIL, REBOOT_PASSWORD);
    
    return {
      success: loggedIn,
      message: loggedIn ? "Successfully logged into Reboot Motion!" : "Login failed",
      sessionId: browserSession.id,
      replayUrl: `https://browserbase.com/sessions/${browserSession.id}`,
    };
  } catch (error) {
    console.error("[TestLogin] Error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
      sessionId: browserSession?.id,
      replayUrl: browserSession?.id ? `https://browserbase.com/sessions/${browserSession.id}` : undefined,
    };
  } finally {
    if (browserSession) {
      await closeSession(apiKey, browserSession.id);
    }
  }
}

/**
 * Find a player only - for testing player search
 */
async function findPlayerOnly(
  apiKey: string,
  projectId: string,
  playerName: string
): Promise<AutomationResult> {
  let browserSession: BrowserbaseSession | null = null;
  
  try {
    const REBOOT_EMAIL = Deno.env.get("REBOOT_EMAIL");
    const REBOOT_PASSWORD = Deno.env.get("REBOOT_PASSWORD");
    
    if (!REBOOT_EMAIL || !REBOOT_PASSWORD) {
      return { success: false, message: "Reboot credentials not configured" };
    }
    
    if (!playerName) {
      return { success: false, message: "Player name required" };
    }
    
    console.log(`[FindPlayer] Creating browser session to find: ${playerName}`);
    browserSession = await createBrowserSession(apiKey, projectId);
    
    // Login first
    const loggedIn = await loginToReboot(apiKey, browserSession.id, REBOOT_EMAIL, REBOOT_PASSWORD);
    if (!loggedIn) {
      return { 
        success: false, 
        message: "Login failed",
        sessionId: browserSession.id,
        replayUrl: `https://browserbase.com/sessions/${browserSession.id}`,
      };
    }
    
    // Search for player
    const playerSearch = await findPlayerInReboot(apiKey, browserSession.id, playerName);
    
    return {
      success: playerSearch.exists,
      message: playerSearch.exists 
        ? `Found player: ${playerName} (Reboot ID: ${playerSearch.playerId})`
        : `Player not found: ${playerName}`,
      data: playerSearch,
      sessionId: browserSession.id,
      replayUrl: `https://browserbase.com/sessions/${browserSession.id}`,
    };
  } catch (error) {
    console.error("[FindPlayer] Error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
      sessionId: browserSession?.id,
      replayUrl: browserSession?.id ? `https://browserbase.com/sessions/${browserSession.id}` : undefined,
    };
  } finally {
    if (browserSession) {
      await closeSession(apiKey, browserSession.id);
    }
  }
}

/**
 * Minimal CDP (Chrome DevTools Protocol) client over WebSocket.
 * Browserbase returns a connectUrl that speaks CDP — this class wraps it.
 */
class CdpBrowser {
  private ws: WebSocket;
  private nextId = 1;
  private callbacks = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private targetSessionId?: string;

  private constructor(ws: WebSocket) {
    this.ws = ws;
    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(String(event.data));
        if (msg.id !== undefined) {
          const cb = this.callbacks.get(msg.id);
          if (cb) {
            this.callbacks.delete(msg.id);
            if (msg.error) cb.reject(new Error(JSON.stringify(msg.error)));
            else cb.resolve(msg.result);
          }
        }
      } catch (e) {
        console.error("[CDP] Parse error:", e);
      }
    };
  }

  static connect(connectUrl: string): Promise<CdpBrowser> {
    console.log("[CDP] Connecting to browser via WebSocket...");
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(connectUrl);
      const cdp = new CdpBrowser(ws);

      ws.onopen = async () => {
        try {
          await cdp.init();
          console.log("[CDP] Connected and initialized");
          resolve(cdp);
        } catch (e) {
          reject(e);
        }
      };

      ws.onerror = (e) => {
        console.error("[CDP] WebSocket error:", e);
        reject(new Error("CDP WebSocket connection failed"));
      };

      setTimeout(() => reject(new Error("CDP connection timeout (20s)")), 20000);
    });
  }

  private async init(): Promise<void> {
    // Attach to the first available page target
    const { targetInfos } = await this.send("Target.getTargets");
    console.log("[CDP] Targets:", targetInfos?.map((t: any) => `${t.type}:${t.targetId}`).join(", "));
    const page = targetInfos?.find((t: any) => t.type === "page");

    if (page) {
      const { sessionId } = await this.send("Target.attachToTarget", {
        targetId: page.targetId,
        flatten: true,
      });
      this.targetSessionId = sessionId;
      console.log(`[CDP] Attached to page target (session: ${sessionId})`);
    } else {
      const { targetId } = await this.send("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await this.send("Target.attachToTarget", {
        targetId,
        flatten: true,
      });
      this.targetSessionId = sessionId;
      console.log(`[CDP] Created and attached to new page target (session: ${sessionId})`);
    }

    await this.send("Page.enable");
    await this.send("Runtime.enable");
  }

  private send(method: string, params: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.callbacks.set(id, { resolve, reject });
      const msg: any = { id, method, params };
      if (this.targetSessionId) msg.sessionId = this.targetSessionId;
      this.ws.send(JSON.stringify(msg));
      setTimeout(() => {
        if (this.callbacks.has(id)) {
          this.callbacks.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 30000);
    });
  }

  async navigate(url: string, extraWaitMs = 5000): Promise<void> {
    console.log(`[CDP] Navigate: ${url}`);
    await this.send("Page.navigate", { url });
    // Wait for load + SPA rendering
    await this.sleep(8000 + extraWaitMs);
  }

  async eval<T = any>(expression: string): Promise<T> {
    const r = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r?.exceptionDetails) {
      const errMsg = r.exceptionDetails.exception?.description || r.exceptionDetails.text || "Unknown eval error";
      throw new Error(`Eval: ${errMsg}`);
    }
    return r?.result?.value as T;
  }

  async waitFor(selector: string, ms = 10000): Promise<boolean> {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      try {
        if (await this.eval<boolean>(`!!document.querySelector('${selector}')`)) return true;
      } catch { /* ignore */ }
      await this.sleep(500);
    }
    return false;
  }

  async fill(selector: string, value: string): Promise<void> {
    const escaped = value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    await this.eval(`
      (() => {
        const el = document.querySelector('${selector}');
        if (!el) throw new Error('Element not found: ${selector}');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, '${escaped}');
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      })()
    `);
  }

  async click(selector: string): Promise<void> {
    await this.eval(`document.querySelector('${selector}')?.click()`);
  }

  async getUrl(): Promise<string> {
    return await this.eval<string>("window.location.href");
  }

  sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  close(): void {
    try { this.ws.close(); } catch { /* ignore */ }
  }
}

/**
 * Pull player reports using CDP-based browser automation.
 * Logs into Reboot, navigates to the player's page, and extracts sessions.
 */
async function pullPlayerReports(
  supabase: any,
  apiKey: string,
  projectId: string,
  playerName: string,
  rebootPlayerId?: string
): Promise<AutomationResult> {
  let browserSession: BrowserbaseSession | null = null;
  let cdp: CdpBrowser | null = null;

  try {
    const REBOOT_EMAIL = Deno.env.get("REBOOT_EMAIL");
    const REBOOT_PASSWORD = Deno.env.get("REBOOT_PASSWORD");

    if (!REBOOT_EMAIL || !REBOOT_PASSWORD) {
      return { success: false, message: "Reboot credentials not configured" };
    }

    if (!playerName && !rebootPlayerId) {
      return { success: false, message: "Player name or Reboot player ID required" };
    }

    console.log(`[PullReports] Starting for: ${playerName} (reboot_id: ${rebootPlayerId || "none"})`);

    // 1. Create Browserbase session
    browserSession = await createBrowserSession(apiKey, projectId);
    console.log(`[PullReports] Browser session: ${browserSession.id}, connectUrl: ${browserSession.connectUrl ? "yes" : "NO"}`);

    if (!browserSession.connectUrl) {
      return {
        success: false,
        message: "No connectUrl returned from Browserbase — cannot establish CDP connection",
        sessionId: browserSession.id,
        replayUrl: `https://browserbase.com/sessions/${browserSession.id}`,
      };
    }

    // 2. Connect via CDP WebSocket
    cdp = await CdpBrowser.connect(browserSession.connectUrl);

    // 3. Login to Reboot
    console.log("[PullReports] Navigating to login page...");
    await cdp.navigate(`${REBOOT_DASHBOARD_URL}/login`, 3000);

    const hasEmailField = await cdp.waitFor('input[type="email"], input[name="email"], input[placeholder*="email"]', 10000);
    if (!hasEmailField) {
      const url = await cdp.getUrl();
      console.log(`[PullReports] No email field found. Current URL: ${url}`);
      if (url.includes("/login")) {
        // Try broader selectors
        const hasAnyInput = await cdp.waitFor("input", 5000);
        console.log(`[PullReports] Any input found: ${hasAnyInput}`);
        const pageHtml = await cdp.eval<string>("document.body.innerHTML.substring(0, 1000)");
        console.log(`[PullReports] Page HTML preview: ${pageHtml}`);
        return {
          success: false,
          message: "Login form not detected — check replay for details",
          sessionId: browserSession.id,
          replayUrl: `https://browserbase.com/sessions/${browserSession.id}`,
        };
      }
      console.log("[PullReports] Not on login page, might be already logged in");
    } else {
      console.log("[PullReports] Filling login form...");
      // Try multiple selectors for email input
      try {
        await cdp.fill('input[type="email"]', REBOOT_EMAIL);
      } catch {
        try { await cdp.fill('input[name="email"]', REBOOT_EMAIL); } catch {
          await cdp.fill('input[placeholder*="email"]', REBOOT_EMAIL);
        }
      }
      await cdp.sleep(500);

      await cdp.fill('input[type="password"]', REBOOT_PASSWORD);
      await cdp.sleep(500);

      // Click submit
      try {
        await cdp.click('button[type="submit"]');
      } catch {
        try { await cdp.click('button:last-of-type'); } catch {
          console.warn("[PullReports] Could not find submit button, trying Enter key");
          await cdp.eval(`
            document.querySelector('input[type="password"]')?.dispatchEvent(
              new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true })
            )
          `);
        }
      }

      // Wait for navigation after login
      await cdp.sleep(8000);

      const postLoginUrl = await cdp.getUrl();
      console.log(`[PullReports] Post-login URL: ${postLoginUrl}`);
      if (postLoginUrl.includes("/login")) {
        return {
          success: false,
          message: "Login failed — still on login page after submission",
          sessionId: browserSession.id,
          replayUrl: `https://browserbase.com/sessions/${browserSession.id}`,
        };
      }
    }

    console.log("[PullReports] ✓ Logged in successfully");

    // 4. Navigate to player page
    const playerPageUrl = rebootPlayerId
      ? `${REBOOT_DASHBOARD_URL}/player/${rebootPlayerId}`
      : `${REBOOT_DASHBOARD_URL}/athletes`;

    console.log(`[PullReports] Navigating to player: ${playerPageUrl}`);
    await cdp.navigate(playerPageUrl, 5000);

    // Extra wait for SPA data loading
    await cdp.sleep(5000);

    // 5. Log page state
    const pageTitle = await cdp.eval<string>("document.title");
    const currentUrl = await cdp.getUrl();
    console.log(`[PullReports] Page: "${pageTitle}" (${currentUrl})`);

    // 6. Extract session data
    const pageData = await cdp.eval<any>(`
      (() => {
        const body = document.body?.innerText || '';
        
        // Collect all links that look like session links
        const sessionLinks = Array.from(document.querySelectorAll('a[href*="/session/"]')).map(a => ({
          href: a.getAttribute('href'),
          text: a.textContent?.trim()?.substring(0, 100),
        }));

        // Try to find session rows in tables or list items
        const rows = Array.from(document.querySelectorAll('tr, [class*="session"], [class*="Session"], li'));
        const sessions = [];

        for (const row of rows) {
          const text = row.textContent || '';
          // Match date patterns
          const dateMatch = text.match(/(\\d{1,2}\\/\\d{1,2}\\/\\d{2,4}|\\d{4}-\\d{2}-\\d{2}|[A-Z][a-z]{2,8} \\d{1,2},? \\d{4})/);
          const link = row.querySelector('a[href*="/session/"]');
          const sessionIdMatch = link?.getAttribute('href')?.match(/\\/session\\/([a-f0-9-]+)/);

          if (dateMatch || sessionIdMatch) {
            sessions.push({
              date: dateMatch?.[1] || null,
              sessionId: sessionIdMatch?.[1] || null,
              text: text.substring(0, 200).trim(),
              href: link?.getAttribute('href') || null,
            });
          }
        }

        return {
          title: document.title,
          url: window.location.href,
          bodySnippet: body.substring(0, 800),
          sessionLinks: sessionLinks.slice(0, 30),
          extractedSessions: sessions.slice(0, 30),
        };
      })()
    `);

    console.log(`[PullReports] Extracted: ${pageData?.extractedSessions?.length || 0} sessions, ${pageData?.sessionLinks?.length || 0} links`);
    console.log(`[PullReports] Body snippet: ${pageData?.bodySnippet?.substring(0, 300)}`);

    return {
      success: true,
      message: `Found ${pageData?.extractedSessions?.length || pageData?.sessionLinks?.length || 0} sessions for ${playerName}`,
      data: {
        playerId: rebootPlayerId,
        playerName,
        sessions: pageData?.extractedSessions || [],
        sessionLinks: pageData?.sessionLinks || [],
        pageTitle: pageData?.title,
        bodySnippet: pageData?.bodySnippet,
      },
      sessionId: browserSession.id,
      replayUrl: `https://browserbase.com/sessions/${browserSession.id}`,
    };
  } catch (error) {
    console.error("[PullReports] Error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
      sessionId: browserSession?.id,
      replayUrl: browserSession?.id
        ? `https://browserbase.com/sessions/${browserSession.id}`
        : undefined,
    };
  } finally {
    if (cdp) cdp.close();
    if (browserSession) await closeSession(apiKey, browserSession.id);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const BROWSERBASE_API_KEY = Deno.env.get("BROWSERBASE_API_KEY");
    const BROWSERBASE_PROJECT_ID = Deno.env.get("BROWSERBASE_PROJECT_ID");
    
    if (!BROWSERBASE_API_KEY || !BROWSERBASE_PROJECT_ID) {
      return new Response(
        JSON.stringify({ error: "Browserbase credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const request: AutomationRequest = await req.json();
    console.log("[Browserbase-Reboot] Request:", request.action);

    let result: AutomationResult;

    switch (request.action) {
      case "full_pipeline":
        result = await runFullPipeline(supabase, BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID, request);
        break;
        
      case "upload_video":
        // Just upload, don't wait for full processing
        result = await runFullPipeline(supabase, BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID, request);
        break;
      
      case "test_login":
        result = await testLoginOnly(BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID);
        break;
      
      case "find_player":
        result = await findPlayerOnly(BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID, request.player_name || "");
        break;
      
      case "pull_reports":
        result = await pullPlayerReports(supabase, BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID, request.player_name || "", request.reboot_player_id);
        break;
        
      default:
        result = { success: false, message: "Unknown action", errors: [`Unsupported action: ${request.action}`] };
    }

    // Log the automation
    await supabase.from("activity_log").insert({
      action: `browserbase_${request.action}`,
      description: result.message,
      player_id: request.player_id,
      metadata: {
        success: result.success,
        browserbase_session_id: result.sessionId,
        replay_url: result.replayUrl,
        errors: result.errors,
      },
    });

    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("[Browserbase-Reboot] Error:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

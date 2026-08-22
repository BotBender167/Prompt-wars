import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { INSTITUTION_NAME } from "@/lib/campus";

interface MessageRequestBody {
  target_profile_id: string;
  searcher_profile_id: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: MessageRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { target_profile_id, searcher_profile_id } = body;
  if (!target_profile_id || !searcher_profile_id) {
    return NextResponse.json({ error: "Missing profile IDs" }, { status: 400 });
  }

  const supabase = createServerClient();

  // Fetch both profiles
  const { data: searcher } = await supabase
    .from("profiles")
    .select("full_name, current_project, looking_for")
    .eq("id", searcher_profile_id)
    .single();

  const { data: target } = await supabase
    .from("profiles")
    .select("full_name, current_project, profile_domains(domains(name))")
    .eq("id", target_profile_id)
    .single();

  if (!searcher || !target) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const targetInterests = (target.profile_domains || [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((pd: any) => pd.domains?.name)
    .filter(Boolean)
    .join(", ");

  const systemPrompt = `You are drafting a brief, genuine message from one student to another on Parivar, a campus network app for ${INSTITUTION_NAME}. Reference only the provided data. Never fabricate details. Be warm, specific, authentic. Keep it 2-3 sentences. Reply with the message text only.`;

  const userPrompt = `Searcher: ${searcher.full_name}
Searcher is building: ${searcher.current_project || "something cool"}
Searcher is looking for: ${searcher.looking_for || "a collaborator"}

Target: ${target.full_name}
Target is building: ${target.current_project || "something cool"}
Target interests: ${targetInterests || "various topics"}

Draft a message from Searcher to Target. Ask why they might connect based on this info.`;

  let draftedMessage = "";

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Mock generation for local development without key
        draftedMessage = `Hi ${target.full_name}, I saw you're interested in ${targetInterests || "similar topics"}. I'm currently building ${searcher.current_project || "a project"} and looking for ${searcher.looking_for || "collaborators"}. Would you be up for a quick chat to see if we could work together on campus?`;
    } else {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-opus-5",
          // Thinking is on by default and its tokens count against max_tokens,
          // so the old 150 would truncate before any prose was produced.
          max_tokens: 2000,
          output_config: { effort: "low" },
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      if (!res.ok) {
        throw new Error(`Anthropic API error: ${res.status} ${res.statusText}`);
      }

      const aiData = await res.json();

      if (aiData.stop_reason === "refusal") {
        throw new Error("Draft declined by the safety classifier");
      }

      // content[] is a mixed list — the first block may be a thinking block, so
      // pick the text block rather than indexing position 0.
      const textBlock = (aiData.content ?? []).find(
        (block: { type?: string }) => block?.type === "text"
      );
      if (!textBlock?.text) {
        throw new Error("Anthropic response contained no text block");
      }
      draftedMessage = textBlock.text;
    }
  } catch (err) {
    console.error("AI drafting failed:", err);
    draftedMessage = `Hi ${target.full_name}, I'd love to connect and chat about what we're both working on.`;
  }

  return NextResponse.json({
    message: draftedMessage.trim(),
    draft_id: crypto.randomUUID(), // mock draft ID
  });
}

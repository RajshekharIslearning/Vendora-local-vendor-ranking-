import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export async function POST(request: Request) {
  try {
    const { vendor_id, stars } = await request.json();

    if (!vendor_id || typeof stars !== "number") {
      return NextResponse.json(
        { error: "vendor_id and stars are required." },
        { status: 400 }
      );
    }

    const clampedStars = Math.min(5, Math.max(1, Math.round(stars)));

    const { data: vendor, error: fetchError } = await supabase
      .from("vendors")
      .select("id, rating_sum, rating_count, add_attempt_count")
      .eq("id", vendor_id)
      .maybeSingle();

    if (fetchError || !vendor) {
      return NextResponse.json(
        { error: fetchError?.message || "Vendor not found." },
        { status: 400 }
      );
    }

    const currentSum = vendor.rating_sum ?? 0;
    const currentCount = vendor.rating_count ?? 0;
    const nextSum = currentSum + clampedStars;
    const nextCount = currentCount + 1;
    const rating_average = nextCount > 0 ? nextSum / nextCount : 0;

    const addCount = vendor.add_attempt_count ?? 0;
    const score = rating_average * 10 + Math.log10(addCount + 1) * 5;

    const { error: updateError } = await supabase
      .from("vendors")
      .update({
        rating_sum: nextSum,
        rating_count: nextCount,
        rating_average,
        score,
      })
      .eq("id", vendor_id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      score,
      rating_average,
      rating_count: nextCount,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to submit rating.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function POST() {

  return NextResponse.json({
    success: true,
    message: "API route working"
  });

}

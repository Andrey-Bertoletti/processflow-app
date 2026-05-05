import { NextResponse } from "next/server";
import { generateAIMessage, GenerateMessageSchema } from "@/lib/ai/generateMessage";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // 1. Validação de Entrada com Zod
    const result = GenerateMessageSchema.safeParse(body);
    
    if (!result.success) {
      console.warn(JSON.stringify({
        event: "ai.generate.validation_error",
        errors: result.error.format()
      }));
      return NextResponse.json(
        { error: "Dados inválidos.", details: result.error.format() },
        { status: 400 }
      );
    }

    // 2. Chama a Camada de Serviço (Service Layer)
    const { message, cached, error, status } = await generateAIMessage(result.data);

    if (error) {
      return NextResponse.json({ error }, { status: status || 500 });
    }

    return NextResponse.json({ message, cached });

  } catch (err: any) {
    console.error(JSON.stringify({
      event: "ai.generate.fatal_error",
      message: err.message
    }));
    return NextResponse.json(
      { error: "Erro interno no servidor." },
      { status: 500 }
    );
  }
}

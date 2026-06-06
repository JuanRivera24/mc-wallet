import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "❌ Falta la GEMINI_API_KEY en el archivo .env.local" }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    const formData = await req.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json({ error: "❌ No se recibió ninguna imagen." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64Data = Buffer.from(bytes).toString("base64");

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      Analiza la lista vertical de turnos de Orquest en la imagen adjunta.
      
      REGLAS DE ESCANEO DE LA IMAGEN COMPLETA:
      1. Recorre la lista de arriba a abajo, procesando estrictamente las 7 filas/tarjetas visibles.
      2. En cada tarjeta:
         - Extrae el número grande del día.
         - Si dice "Día libre", pon startTime y endTime como strings vacíos, e isOff en true.
         - Si tiene un turno de horas, conviértelo a formato militar de 24 horas (HH:MM) y pon isOff en false.
    `;

    // 🛡️ TRUCO: Le ponemos ": any" para que TypeScript apague las alarmas rojas
    const responseSchema: any = {
      type: SchemaType.OBJECT,
      properties: {
        shifts: {
          type: SchemaType.ARRAY,
          description: "Lista de los 7 turnos extraídos en orden",
          items: {
            type: SchemaType.OBJECT,
            properties: {
              day: { type: SchemaType.NUMBER, description: "El número del día del mes (ej: 13)" },
              startTime: { type: SchemaType.STRING, description: "Hora de entrada (ej: 15:00) o vacío" },
              endTime: { type: SchemaType.STRING, description: "Hora de salida (ej: 22:00) o vacío" },
              isOff: { type: SchemaType.BOOLEAN, description: "true si es día libre, false si tiene turno" }
            },
            required: ["day", "startTime", "endTime", "isOff"]
          }
        }
      },
      required: ["shifts"]
    };

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { data: base64Data, mimeType: file.type || "image/png" } }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    } as any);

    const responseText = result.response.text();
    return NextResponse.json(JSON.parse(responseText.trim()));

  } catch (error: any) {
    console.error("🔥 ERROR EN API:", error);
    return NextResponse.json({ error: error.message || "Error interno del servidor" }, { status: 500 });
  }
}
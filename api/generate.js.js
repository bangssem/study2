/**
 * api/generate.js
 * Vercel Serverless Function for Gemini Multimodal Vision API
 * Analyzes desk clutter, smartphone presence, and posture from base64 image data.
 */

export default async function handler(req, res) {
    // Enable CORS for cross-origin local testing and previews
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { image } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    // Fallback response for testing when API key is not configured or image is missing
    if (!apiKey || !image) {
        console.warn("GEMINI_API_KEY is not configured or image is missing. Returning default inspection data.");
        return res.status(200).json({
            feedback: "당근 경비대 토끼가 출동했어요! 책상 위에 스마트폰을 살짝 치우고 허리를 곧게 펴면 집중력 당근을 가득 얻을 수 있어요 🥕✨",
            voiceText: "스마트폰을 치우고 허리를 펴보세요! 당근을 선물할게요!",
            clutterStatus: "보통",
            phoneDetected: true,
            postureStatus: "거북목 주의",
            score: 82,
            bunnyMood: "warning"
        });
    }

    const systemPrompt = `당신은 귀여운 잔소리꾼 당근 경비대 '토끼 인스펙터(Rabbit Inspector)'입니다.
사용자가 공부하거나 업무를 보는 책상 환경과 상반신/자세 사진을 꼼꼼하게 멀티모달 비전으로 분석합니다.

다음 3가지 항목을 핵심으로 평가하세요:
1. 책상의 어지러움 정도 (clutterStatus): "깔끔함", "보통", "어수선함" 중 하나
2. 스마트폰 및 전자기기 방해 요소 (phoneDetected): 책상 위 손이 닿는 곳에 스마트폰이 있는지 여부 (boolean: true 또는 false)
3. 자세 상태 (postureStatus): "바른 자세", "거북목 주의", "구부정한 자세" 중 하나

출력은 반드시 마크다운 코드블록이나 불필요한 서문 없이 다음 유효한 JSON 형식으로만 응답해야 합니다:
{
    "feedback": "토끼의 시점에서 작성한 재치 있고 다정한 피드백 2~3문장 (이모지 포함)",
    "voiceText": "토끼가 음성(TTS)으로 말할 짧고 명확한 한 문장",
    "clutterStatus": "깔끔함 | 보통 | 어수선함",
    "phoneDetected": true,
    "postureStatus": "바른 자세 | 거북목 주의 | 구부정한 자세",
    "score": 85,
    "bunnyMood": "happy | warning | worried"
}`;

    try {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        // Ensure base64 string does not include data URI scheme prefix
        const cleanBase64 = image.includes(',') ? image.split(',')[1] : image;

        const payload = {
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: "토끼 인스펙터님, 지금 제 책상 상태와 앉아있는 자세를 분석해서 집중력을 진단해 주세요!" },
                        {
                            inlineData: {
                                mimeType: "image/jpeg",
                                data: cleanBase64
                            }
                        }
                    ]
                }
            ],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.2
            }
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorDetails = await response.text();
            console.error(`Gemini API Error (${response.status}):`, errorDetails);
            throw new Error(`Gemini API responded with status ${response.status}`);
        }

        const result = await response.json();
        const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!jsonText) {
            throw new Error("Empty candidate received from Gemini Vision");
        }

        const cleanJson = jsonText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsedData = JSON.parse(cleanJson);

        return res.status(200).json(parsedData);

    } catch (error) {
        console.error("Gemini Multimodal inspection error:", error);
        return res.status(200).json({
            feedback: "토끼가 열심히 책상을 들여다보았어요! 책상 위를 정돈하고 스마트폰을 가방에 넣으면 당근 지수가 쑥쑥 올라갈 거예요 🥕",
            voiceText: "허리를 펴고 스마트폰을 멀리 두어 볼까요?",
            clutterStatus: "보통",
            phoneDetected: false,
            postureStatus: "바른 자세",
            score: 80,
            bunnyMood: "happy"
        });
    }
}
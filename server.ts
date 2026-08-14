import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Helper lazy initializer for Gemini AI
  function getAI() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is missing.');
    }
    return new GoogleGenAI({ apiKey });
  }

  // API endpoint for AI Question Generation
  app.post('/api/ai/generate-questions', async (req, res) => {
    try {
      const { subject, grade, topic, count, type } = req.body;
      const ai = getAI();

      const prompt = `شما یک معلم دلسوز و حرفه‌ای مدرسه‌ای هستید.
لطفاً ${count || 5} سوال استاندارد برای امتحانات حضوری مدارس در درس "${subject || 'ریاضی'}" پایه "${grade || 'دوازدهم'}" درباره مبحث "${topic || 'کلی'}" با بارم‌بندی دقیق تولید کنید.

نوع سوالات درخواستی: ${type === 'all' ? 'ترکیبی از تشریحی، تست، جای خالی، صحیح/غلط و کوتاه پاسخ' : type}

پاسخ را حتماً و بدون هیچ متن اضافه، فقط به صورت یک JSON معتبر آرایه‌ای از اشیاء سوال با ساختار زیر بازگردانید:
[
  {
    "id": "ai_1",
    "type": "essay" | "multiple_choice" | "blank" | "true_false" | "short_answer",
    "text": "متن سوال با نگارش فارسی روان",
    "score": 1.5,
    "category": "${topic || 'عمومی'}",
    "options": ["گزینه ۱", "گزینه ۲", "گزینه ۳", "گزینه ۴"], // فقط اگر type="multiple_choice" باشد
    "correctOption": 0, // ایندکس 0 تا 3 فقط برای تست
    "trueFalseAnswer": true, // فقط برای صحیح/غلط
    "answerText": "پاسخ تشریحی دقیق و راهنمای تصحیح برای معلم",
    "answerSpaceLines": 3
  }
]`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const responseText = response.text || '[]';
      const questions = JSON.parse(responseText);

      res.json({ success: true, questions });
    } catch (error: any) {
      console.error('AI Generation Error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'خطا در برقراری ارتباط با هوش مصنوعی',
      });
    }
  });

  // API endpoint for AI Answer Key Generation for existing questions
  app.post('/api/ai/generate-answers', async (req, res) => {
    try {
      const { questions, subject } = req.body;
      const ai = getAI();

      const prompt = `شما یک معلم مجرب هستید. برای سوالات امتحانی زیر در درس "${subject || 'عمومی'}"، پاسخ تشریحی کامل، کلیدواژه‌های اصلی تصحیح و راهنمای نمره‌دهی تهیه کنید.

سوالات:
${JSON.stringify(questions, null, 2)}

پاسخ را فقط به صورت JSON معتبر به شکل آرایه‌ای با همان id ها بازگردانید:
[
  {
    "id": "سوال مربوطه",
    "answerText": "پاسخ کامل و دقیق",
    "keywords": ["کلیدواژه ۱", "کلیدواژه ۲"]
  }
]`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const responseText = response.text || '[]';
      const answers = JSON.parse(responseText);

      res.json({ success: true, answers });
    } catch (error: any) {
      console.error('AI Answers Error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'خطا در تولید پاسخ‌نامه با هوش مصنوعی',
      });
    }
  });

  // Vite middleware for dev or static serving for prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

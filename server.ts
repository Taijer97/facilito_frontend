import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import multer from "multer";
import { fileURLToPath } from 'url';
import dotenv from "dotenv";
dotenv.config({ override: true });

const serverFilename = typeof import.meta !== 'undefined' && import.meta.url 
  ? fileURLToPath(import.meta.url) 
  : (typeof __filename !== 'undefined' ? __filename : '');
const serverDirname = typeof import.meta !== 'undefined' && import.meta.url 
  ? path.dirname(serverFilename) 
  : (typeof __dirname !== 'undefined' ? __dirname : process.cwd());

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use memory storage for quick processing or disk storage to save to public
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      const dir = path.join(serverDirname, 'public', 'qrs');
      if (!fs.existsSync(dir)){
          fs.mkdirSync(dir, { recursive: true });
      }
      cb(null, dir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  });

  const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Ensure public/qrs exists at startup
  const qrDir = path.join(serverDirname, 'public', 'qrs');
  if (!fs.existsSync(qrDir)) {
    fs.mkdirSync(qrDir, { recursive: true });
  }

  // Serve uploaded QRs explicitly - this makes them accessible at /qrs/...
  app.use('/qrs', express.static(qrDir));

  // API Route for QR Upload
  app.post("/api/upload-qr", (req, res, next) => {
    console.log(`POST /api/upload-qr received`);
    next();
  }, upload.single('qr'), (req: any, res: any) => {
    if (!req.file) {
      console.log("Upload failed: No file");
      return res.status(400).json({ error: "No file uploaded" });
    }
    console.log(`File uploaded: ${req.file.filename}`);
    const filePath = `/qrs/${req.file.filename}`;
    res.json({ url: filePath });
  });

  // Cache for the Yape Access Token
  let cachedYapeToken: string | null = null;
  let envTokenAttempted = false;

  async function getYapeAccessToken(forceRefresh = false) {
    // If forceRefresh is true, we always call the auth endpoint
    if (forceRefresh) {
      cachedYapeToken = null;
    } else {
      // 1. Try cached token
      if (cachedYapeToken) return cachedYapeToken;

      // 2. Try .env token ONLY once if no cached token and no refresh forced
      if (!envTokenAttempted && process.env.YAPE_API_TOKEN) {
        console.log("📝 Probando token proporcionado en .env");
        envTokenAttempted = true;
        cachedYapeToken = process.env.YAPE_API_TOKEN;
        return cachedYapeToken;
      }
    }

    console.log("🔐 Generando nuevo token de acceso para Yape mediante endpoint...");
    try {
      const authUrl = process.env.YAPE_API_AUTH || 'https://e5d1-38-211-62-100.ngrok-free.app/api/v1/auth/token';
      const response = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: "admin",
          password: "admin"
        })
      });

      if (!response.ok) {
        throw new Error(`Error de autenticación (${response.status}): ${response.statusText}`);
      }

      const responseText = await response.text();
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch (err) {
        console.error(`❌ Yape Auth endpoint did not return valid JSON. Response starts with: ${responseText.substring(0, 200)}`);
        throw new Error("El portal externo de autenticación de Yape se encuentra fuera de servicio (retornó una respuesta ilegible).");
      }

      if (data && data.access_token) {
        cachedYapeToken = data.access_token;
        console.log("✅ Nuevo Token de Yape generado exitosamente.");
        return cachedYapeToken;
      }
      throw new Error("No se recibió access_token en la respuesta");
    } catch (error) {
      console.error("❌ Error al obtener token de Yape:", error);
      return null;
    }
  }

  // Proxy route for Yape payment verification
  app.post("/api/verify-payment", async (req, res) => {
    console.log("Verify Payment Request Body:", JSON.stringify(req.body));
    try {
      const { nombre, apellido, monto, codigoSeguridad, fecha } = req.body;
      let token = await getYapeAccessToken();
      const apiUrl = process.env.YAPE_API_URL || 'https://e5d1-38-211-62-100.ngrok-free.app/api/v1/verify/front?use_time_range=true';

      if (!token) {
        console.error("❌ No se pudo obtener un token válido");
        return res.status(200).json({ 
          matched: false, 
          payment_status: "ERROR", 
          reason: "No se pudo autenticar con el servicio externo de Yape. El portal de verificación podría estar temporalmente fuera de línea." 
        });
      }

      const makeRequest = async (currentToken: string) => {
        console.log(`📡 Llamando a la API de Yape: ${apiUrl}`);
        return fetch(apiUrl, {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'Authorization': `Bearer ${currentToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            nombre,
            apellido,
            monto,
            codigoSeguridad,
            fecha
          })
        });
      };

      const handleResponse = async (resp: Response) => {
        const text = await resp.text();
        try {
          return JSON.parse(text);
        } catch (err) {
          console.error(`Received invalid JSON from Yape Verification. Status: ${resp.status}. Response starts with: ${text.substring(0, 200)}`);
          return {
            error: true,
            isHtmlError: true,
            rawText: text
          };
        }
      };

      let response = await makeRequest(token);
      let data = await handleResponse(response);

      // If token is invalid, refresh it and retry
      if (data && (data.detail === "Token inválido" || data.detail === "Could not validate credentials")) {
        console.log("🔄 Token invalidado detectado. Reintentando con nuevo token forzado...");
        token = await getYapeAccessToken(true); // FORCED REFRESH
        if (token) {
          response = await makeRequest(token);
          data = await handleResponse(response);
        }
      }

      if (data && data.isHtmlError) {
        let errorMsg = "La API de Yape retornó una respuesta que no es JSON válido.";
        if (data.rawText && data.rawText.includes("ngrok")) {
          errorMsg = "El servidor de verificación externa de Yape (Ngrok) se encuentra desconectado u offline. Por favor, selecciona el método manual o avisa al soporte para activar el servicio automático.";
        }
        console.log("❌ Error de formato externo (Ngrok):", errorMsg);
        return res.status(200).json({
          matched: false,
          payment_status: "ERROR",
          reason: errorMsg
        });
      }
      
      console.log("Yape API Response:", JSON.stringify(data));
      res.json(data);
    } catch (error) {
      console.error("Error verifying payment:", error);
      res.status(200).json({ 
        matched: false, 
        payment_status: "ERROR", 
        reason: "Error interno del servidor al verificar el pago" 
      });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Catch unmatched API routes to prevent them from hitting Vite's SPA fallback
  app.use("/api/*", (req, res) => {
    res.status(404).json({ error: `API route ${req.originalUrl} not found` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(serverDirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

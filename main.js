
const http = require('http');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');


const { program } = require('commander');
const superagent = require('superagent');



program
  .requiredOption('-h, --host <type>', "Адреса сервера")
  .requiredOption('-p, --port <type>', "Порт сервера")
  .requiredOption('-c, --cache <type>', "Шлях до директорії кешу");

program.parse(process.argv);
const options = program.opts();

const host = options.host;
const port = options.port;
const cacheDir = options.cache;


if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
  console.log(`Cache directory created at: ${cacheDir}`);
}



const server = http.createServer(async (req, res) => {
  const urlPath = req.url; 

  if (!/^\/\d+$/.test(urlPath)) {
  
    res.writeHead(400);
    res.end('Bad Request: URL must be in /<status_code> format.');
    return;
  }
  
  const statusCode = urlPath.slice(1); 
  const filePath = path.join(cacheDir, `${statusCode}.jpeg`);

  try {
    switch (req.method) {
      
    
      case 'GET':
        try {
         
          const data = await fsp.readFile(filePath);
           console.log(`Cache HIT for ${statusCode}`);
          res.writeHead(200, { 'Content-Type': 'image/jpeg' });
          res.end(data);
        } catch (error) {
         
          console.log(`Cache MISS for ${statusCode}. Fetching from http.cat...`);
          try {
            const httpCatUrl = `https://http.cat/${statusCode}`;
            
            const response = await superagent.get(httpCatUrl);
            
            const imageBuffer = response.body;

            
            await fsp.writeFile(filePath, imageBuffer);
            
           
            res.writeHead(200, { 'Content-Type': 'image/jpeg' });
            res.end(imageBuffer);
          } catch (httpCatError) {
           
            console.error(`Failed to fetch from http.cat: ${httpCatError.message}`);
            res.writeHead(404);
            res.end('Not Found (from upstream server)');
          }
        }
        break;

     
      case 'PUT':
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', async () => {
          try {
            const body = Buffer.concat(chunks);
            await fsp.writeFile(filePath, body);
            res.writeHead(201); 
            res.end('Created');
          } catch (writeError) {
            console.error("Error writing to cache:", writeError);
            res.writeHead(500);
            res.end('Server Error');
          }
        });
        break;

     
      case 'DELETE':
        try {
          await fsp.unlink(filePath); 
          res.writeHead(200); 
          res.end('OK');
        } catch (error) {
          // не було в кеші
          res.writeHead(404);
          res.end('Not Found');
        }
        break;
      
    
      default:
        res.writeHead(405); 
        res.end('Method Not Allowed');
    }
  } catch (e) {

    console.error("General server error:", e);
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});


server.listen(port, host, () => {
  console.log(`Proxy server running at http://${host}:${port}`);
});
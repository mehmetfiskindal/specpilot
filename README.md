# SpecPilot 🚀

SpecPilot, OpenAPI (Swagger) spesifikasyonlarınız ile backend kaynak kodunuzu (Express & NestJS) hizalayan, aradaki boşlukları (gap), eksik testleri ve sözleşme (contract) risklerini tespit eden **AI destekli bir API analiz ve operasyon aracıdır**.

Proje üç temel bileşenden oluşur:
1. **CLI**: Projeyi analiz etmek ve raporlar oluşturmak için.
2. **MCP Server**: AI asistanlarının (Claude, Cursor, VS Code vb.) projenizi analiz etmesini sağlayan standart protokol.
3. **AI Developer Skill**: AI modellerine OpenAPI-first geliştirmeyi öğreten sistem yönergesi.

---

## 📦 Kurulum ve Derleme

Projeyi yerelinizde derlemek ve kullanıma hazır hale getirmek için aşağıdaki adımları takip edin:

1. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```

2. TypeScript kodunu derleyin:
   ```bash
   npm run build
   ```

3. Geliştirme aşamasında doğrudan çalıştırmak için:
   ```bash
   npm run dev -- --help
   ```

---

## 💻 CLI Kullanımı

SpecPilot CLI, projenizde gap analizlerini başlatmak için kullanılır.

### 1. Başlangıç Kurulumu (Setup)
Projenizin kök dizininde aşağıdaki komutu çalıştırarak yapılandırma dosyalarını ve AI skill dosyasını oluşturun:
```bash
node dist/cli/index.js setup
```
*Bu komut projenizdeki OpenAPI spec dosyasını, framework'ü (Express veya NestJS) ve kaynak kod dizinini otomatik olarak algılar ve `.specpilot/config.json` ile `.specpilot/specpilot-skill.md` dosyalarını üretir.*

### 2. API Gap Analizi (Analyze)
Spec ve kod arasındaki uyumsuzlukları raporlamak için:
```bash
node dist/cli/index.js analyze
```
*Bu komut eksik uç noktaları (endpoints), eksik test dosyalarını ve güvenlik/doğrulama risklerini terminalde renklendirilmiş olarak gösterir ve `.specpilot/api-gap-report.md` dosyasına kaydeder.*

### 3. İstemci Dokümantasyonu ve Tip Oluşturucu (Doc)
Spesifikasyondaki veri modellerini otomatik olarak TypeScript arayüzlerine dönüştürmek, örnek istek/yanıt JSON şablonlarını üretmek ve frontend/mobil ekipleri için entegrasyon kılavuzu hazırlamak için:
```bash
node dist/cli/index.js doc
```
*Bu komut `.specpilot/client-integration-guide.md` dosyasını oluşturur. Mobil veya frontend ekipleriniz bu dokümandaki veri tiplerini ve JSON şablonlarını doğrudan entegrasyon sürecinde kullanabilir.*

---

## 🤖 MCP (Model Context Protocol) Server Kullanımı

SpecPilot'ı bir **MCP Server** olarak çalıştırıp AI asistanınıza bağlayabilirsiniz. Bu sayede AI, kod yazarken veya analiz yaparken arka planda otomatik olarak SpecPilot araçlarını çağırabilir.

### MCP Araçları (Tools)
- `analyze_openapi`: OpenAPI spesifikasyonu ile kod arasındaki farkları analiz eder (eksik endpoint'ler, riskli endpoint'ler vb. raporlar).
- `find_missing_tests`: Test dosyası yazılmamış API rotalarını bulur.
- `generate_integration_guide`: Spesifikasyon dosyasını okuyarak frontend/mobil geliştiriciler için tüm veri modellerini, TypeScript tiplerini ve istek/yanıt JSON örneklerini barındıran tam entegrasyon kılavuzunu Markdown biçiminde döndürür.

### Client Konfigürasyonları

#### 1. Claude Desktop ile Kullanım
Claude Desktop uygulamasında MCP sunucusunu etkinleştirmek için aşağıdaki adımları izleyin:

1. Claude Desktop konfigürasyon dosyasını açın:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. `mcpServers` altına `specpilot` tanımını ekleyin:
   ```json
   {
     "mcpServers": {
       "specpilot": {
         "command": "node",
         "args": [
           "/absolute/path/to/specpilot/dist/cli/index.js",
           "mcp"
         ],
         "cwd": "/absolute/path/to/your/backend/project"
       }
     }
   }
   ```
   *(Not: `/absolute/path/to/specpilot` kısmını projenin bilgisayarınızdaki gerçek tam yolu ile değiştirin. `cwd` kısmına ise analiz etmek istediğiniz hedef backend projesinin yolunu yazın.)*

3. Claude uygulamasını tamamen kapatıp yeniden başlatın. Sağ alttaki 🔌 (fiş) ikonunda `specpilot` sunucusunu ve araçlarını göreceksiniz.

#### 2. Cursor IDE ile Kullanım
Cursor üzerinde SpecPilot MCP araçlarını kullanmak için:

1. **Cursor Settings** > **Features** > **MCP** bölümüne gidin.
2. **+ Add New MCP Server** butonuna tıklayın.
3. Parametreleri şu şekilde doldurun:
   - **Name**: `specpilot`
   - **Type**: `command`
   - **Command**: `node /absolute/path/to/specpilot/dist/cli/index.js mcp`
4. **Save** butonuna tıklayarak sunucuyu kaydedin. Cursor Composer veya Chat üzerinden doğrudan `@specpilot` veya araçları çağırabilirsiniz.

---

## 💡 Örnek Analiz Raporu Çıktısı

`analyze` komutu veya MCP aracı çalıştırıldığında aşağıdaki gibi bir çıktı üretilir:

```markdown
=== API GAP REPORT ===

❌ Missing in Code (OpenAPI spec has these, but code does not):
  - POST /auth/refresh (Refresh Token)

🧪 Missing Tests (Implemented endpoints without matching test files):
  - POST /auth/login (Expected: src/controllers/auth.controller.test.ts)

⚡ Risky Endpoints (Contract mismatches / Security risks):
  - [HIGH] POST /items: Requires auth in spec, but auth middleware/guard was not detected in code.
```

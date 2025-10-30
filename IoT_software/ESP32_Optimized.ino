#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>

// ========== CẤU HÌNH WIFI ==========
const char* ssid = "1917";        // Tên mạng WiFi cần kết nối
const char* password = "44444444";   // Mật khẩu WiFi

// ========== CẤU HÌNH MQTT BROKER ==========
const char* mqtt_server = "10.142.248.176";  // Địa chỉ IP của MQTT broker
const int mqtt_port = 1883;                   // Cổng MQTT
const char* mqtt_user = "adminiot";           // Tên đăng nhập MQTT
const char* mqtt_pass = "adminiot";           // Mật khẩu MQTT

// ========== KHỞI TẠO CLIENT ==========
WiFiClient espClient;           // Tạo client WiFi
PubSubClient client(espClient); // Tạo client MQTT sử dụng WiFi client

// ========== CẤU HÌNH CHÂN GPIO ==========
#define DHTPIN 16       // GPIO16: Chân DATA của cảm biến DHT11
#define DHTTYPE DHT11   // Loại cảm biến nhiệt độ/độ ẩm là DHT11
#define DIEUHOA 18      // GPIO18: Chân điều khiển relay điều hòa
#define QUAT 13         // GPIO13: Chân điều khiển relay quạt
#define DEN 26          // GPIO26: Chân điều khiển relay đèn
#define LDR_PIN 32      // GPIO32: Chân analog đọc cảm biến ánh sáng LDR

// ========== KHỞI TẠO CẢM BIẾN DHT ==========
DHT dht(DHTPIN, DHTTYPE);   // Khởi tạo đối tượng cảm biến DHT11

// ========== BIẾN THỜI GIAN ==========
unsigned long lastMsg = 0;   // Lưu thời điểm gửi message cuối cùng

// ========== CẤU HÌNH ADC ==========
const uint8_t adcBits = 12;       // Độ phân giải ADC của ESP32: 12-bit (0-4095)
const uint16_t adcMaxValue = 4095; // Giá trị tối đa của ADC 12-bit

// ========== QUẢN LÝ TRẠNG THÁI THIẾT BỊ ==========
uint8_t deviceStates = 0;

// Hàm đọc trạng thái thiết bị từ bit flags
inline bool getDeviceState(uint8_t device) { 
  return (deviceStates >> device) & 1; 
}

// Hàm cập nhật trạng thái thiết bị vào bit flags
inline void setDeviceState(uint8_t device, bool state) { 
  if (state) 
    deviceStates |= (1 << device);   // Set bit thành 1 (BẬT)
  else 
    deviceStates &= ~(1 << device);  // Set bit thành 0 (TẮT)
}

// ========== MACRO TÌM KIẾM NHANH ==========
#define DEVICE_COUNT 3  // Số lượng thiết bị có thể điều khiển

// ========== VALIDATION FUNCTIONS - TỐI ƯU ==========
// Hàm kiểm tra dữ liệu nhiệt độ hợp lệ
bool isValidTemperature(float temp) {
  return !isnan(temp) && temp >= -50.0 && temp <= 100.0;
}

// Hàm kiểm tra dữ liệu độ ẩm hợp lệ
bool isValidHumidity(float hum) {
  return !isnan(hum) && hum >= 0.0 && hum <= 100.0;
}

// Hàm kiểm tra dữ liệu ánh sáng hợp lệ
bool isValidLight(uint16_t light) {
  return light <= 100000;
}

// ========== ERROR HANDLING - TỐI ƯU ==========
uint16_t errorCount = 0;           // Đếm số lỗi liên tiếp
const uint16_t MAX_ERRORS = 10;    // Số lỗi tối đa trước khi restart
unsigned long lastErrorTime = 0;   // Thời gian lỗi cuối cùng
const unsigned long ERROR_RESET_TIME = 30000; // 30 giây reset error counter

// ✅ THÊM MỚI: Restart cooldown để tránh restart loop
unsigned long lastRestartTime = 0;        // Thời gian restart cuối cùng
const unsigned long RESTART_COOLDOWN = 60000; // 60 giây cooldown giữa các lần restart

// ========== HÀM KẾT NỐI WIFI ==========
void setup_wifi() {
  delay(10);  // Đợi hệ thống ổn định
  
  Serial.print("Đang kết nối WiFi: ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);  // Chế độ Station (client), không phải Access Point
  WiFi.begin(ssid, password);  // Bắt đầu kết nối đến WiFi
  
  // Chờ kết nối WiFi thành công
  uint8_t attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) { 
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi đã kết nối!");
    Serial.print("📡 IP ESP32: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n❌ Kết nối WiFi thất bại!");
  }
}

// ========== HÀM GỬI PHẢN HỒI TRẠNG THÁI ==========
void sendDeviceFeedback(const char* device, const char* state) {
  char topic[40];
  snprintf(topic, sizeof(topic), "esp32/ack/%s", device);  // ACK: esp32/ack/dieuhoa, ack/quat, ack/den
  
  if (client.publish(topic, state, false)) {  // Publish message (retain=false)
    Serial.printf("📤 Phản hồi: %s -> %s\n", topic, state);
  }
  
  delay(50);  // Delay nhỏ đảm bảo message được gửi hoàn toàn
}

// ========== HÀM CALLBACK MQTT ==========
void callback(char* topic, byte* payload, unsigned int length) {
  // Parse trạng thái ON/OFF trực tiếp từ payload (tiết kiệm RAM)
  bool isOn = (length >= 2 && payload[0] == 'O' && payload[1] == 'N');
  
  Serial.printf("📩 Nhận lệnh [%s]: %s\n", topic, isOn ? "ON" : "OFF");

  // ========== LOOKUP TABLE CHO THIẾT BỊ ==========
  // Cấu trúc lưu thông tin của mỗi thiết bị
  struct DeviceConfig {
    const char* topicSuffix;  // Tên thiết bị trong topic (dieuhoa, quat, den)
    uint8_t pin;              // Chân GPIO điều khiển relay
    uint8_t deviceIndex;      // Index trong bit flags (0, 1, 2)
    const char* name;         // Tên hiển thị tiếng Việt
  };
  
  // Bảng tra cứu thiết bị (lưu trong FLASH, tiết kiệm RAM)
  static const DeviceConfig devices[DEVICE_COUNT] = {
    {"dieuhoa", DIEUHOA, 2, "Điều hòa"},
    {"quat",    QUAT,    1, "Quạt"},
    {"den",     DEN,     0, "Đèn"}
  };
  
  // Tìm thiết bị tương ứng trong lookup table
  for (uint8_t i = 0; i < DEVICE_COUNT; i++) {
    char fullTopic[30];
    snprintf(fullTopic, sizeof(fullTopic), "esp32/cmd/%s", devices[i].topicSuffix);
    
    // So sánh topic nhận được với topic của thiết bị
    if (strcmp(topic, fullTopic) == 0) {
      bool currentState = getDeviceState(devices[i].deviceIndex);
      
      // Chỉ thực hiện nếu trạng thái thay đổi
      if (currentState != isOn) {
        digitalWrite(devices[i].pin, isOn ? HIGH : LOW);  // Điều khiển relay
        setDeviceState(devices[i].deviceIndex, isOn);     // Cập nhật trạng thái trong RAM
        Serial.printf("🔧 %s: %s\n", devices[i].name, isOn ? "BẬT ✅" : "TẮT ❌");
        
        // Gửi phản hồi xác nhận về backend
        sendDeviceFeedback(devices[i].topicSuffix, isOn ? "ON" : "OFF");
      } else {
        Serial.printf("⏭️  %s: Bỏ qua (đã %s)\n", devices[i].name, isOn ? "BẬT" : "TẮT");
      }
      break;  // Đã tìm thấy, thoát vòng lặp
    }
  }
}

// ========== HÀM KẾT NỐI LẠI MQTT ==========
void reconnect() {
  while (!client.connected()) {
    Serial.print("🔄 Đang kết nối MQTT broker...");
    
    // Kết nối với Last Will Testament (LWT)
    // LWT sẽ tự động gửi "offline" khi ESP32 mất kết nối đột ngột
    if (client.connect("ESP32Client", mqtt_user, mqtt_pass, 
                       "esp32/status", 1, true, "offline")) {
      Serial.println(" ✅ Thành công!");
      
      // Gửi trạng thái online (retained message)
      client.publish("esp32/status", "online", true);
      Serial.println("📤 Đã gửi: esp32/status -> online");
      
      // Subscribe các topic điều khiển (kênh CMD)
      client.subscribe("esp32/cmd/dieuhoa");
      client.subscribe("esp32/cmd/quat");
      client.subscribe("esp32/cmd/den");
      Serial.println("📥 Đã subscribe: esp32/cmd/dieuhoa, esp32/cmd/quat, esp32/cmd/den");
      
      // Yêu cầu đồng bộ trạng thái với database
      client.publish("esp32/sync_request", "sync", false);
      Serial.println("🔄 Yêu cầu đồng bộ trạng thái từ database");
      
    } else {
      // Kết nối thất bại, hiển thị mã lỗi
      Serial.printf(" ❌ Thất bại! Mã lỗi: %d\n", client.state());
      Serial.println("⏳ Thử lại sau 5 giây...");
      delay(5000);
    }
  }
}

// ========== ERROR HANDLING FUNCTIONS ==========
// Hàm xử lý lỗi MQTT
void handleMQTTError() {
  if (!client.connected()) {
    Serial.println("🔄 MQTT disconnected, attempting reconnect...");
    reconnect();
  }
}

// Hàm reset error counter sau một khoảng thời gian
void resetErrorCounter() {
  unsigned long now = millis();
  if (now - lastErrorTime > ERROR_RESET_TIME) {
    errorCount = 0;
    lastErrorTime = now;
  }
}

// ========== HÀM SETUP (CHẠY 1 LẦN KHI KHỞI ĐỘNG) ==========
void setup() {
  // Khởi tạo Serial Monitor với baudrate 115200
  Serial.begin(115200);
  delay(100);
  Serial.println("\n\n========================================");
  Serial.println("🚀 ESP32 IoT Controller Starting...");
  Serial.println("========================================");
  
  // Cấu hình chân GPIO là OUTPUT để điều khiển relay
  pinMode(DIEUHOA, OUTPUT);
  pinMode(QUAT, OUTPUT);
  pinMode(DEN, OUTPUT);
  Serial.println("⚙️  GPIO đã được cấu hình");

  // Đặt tất cả thiết bị về trạng thái TẮT ban đầu
  digitalWrite(DIEUHOA, LOW);
  digitalWrite(QUAT, LOW);
  digitalWrite(DEN, LOW);
  Serial.println("🔌 Thiết bị khởi tạo: TẮT");

  // Khởi động cảm biến DHT11
  dht.begin();
  Serial.println("🌡️  DHT11 đã khởi động");

  // Kết nối WiFi
  setup_wifi();

  // Cấu hình MQTT server và callback
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
  Serial.printf("📡 MQTT server: %s:%d\n", mqtt_server, mqtt_port);

  // Cấu hình độ phân giải ADC cho cảm biến ánh sáng
  analogReadResolution(adcBits);
  Serial.printf("📊 ADC: %d-bit (0-%d)\n", adcBits, adcMaxValue);

  Serial.println("========================================");
  Serial.println("✅ Khởi động thành công!");
  Serial.println("========================================\n");
}

// ========== HÀM LOOP (CHẠY LIÊN TỤC) ==========
// - Gửi dữ liệu lên MQTT broker
// - Gửi heartbeat để backend biết ESP32 còn hoạt động
void loop() {
  // Kiểm tra kết nối MQTT, reconnect nếu bị mất
  if (!client.connected()) {
    handleMQTTError();
  }
  client.loop();  // Xử lý các message MQTT đến

  unsigned long now = millis();
  
  // ✅ TỐI ƯU: Tăng interval từ 1s lên 2s để giảm network traffic
  if (now - lastMsg >= 2000) {
    lastMsg = now;

    // ✅ THÊM: Kiểm tra kết nối MQTT
    handleMQTTError();

    // ========== ĐỌC CẢM BIẾN DHT11 ==========
    float h = dht.readHumidity();       // Đọc độ ẩm (%)
    float t = dht.readTemperature();    // Đọc nhiệt độ (°C)

    // ========== ĐỌC CẢM BIẾN ÁNH SÁNG LDR ==========
    // Đảo ngược giá trị ADC vì LDR cho giá trị cao khi tối
    uint16_t rawLight = analogRead(LDR_PIN);
    uint16_t lightValue = map(rawLight, 0, adcMaxValue, adcMaxValue, 0);

    // ========== VALIDATION VÀ GỬI DỮ LIỆU ==========
    // ✅ TỐI ƯU: Validation dữ liệu và gửi JSON đơn giản
    if (isValidTemperature(t) && isValidHumidity(h) && isValidLight(lightValue)) {
      char jsonData[100];
      snprintf(jsonData, sizeof(jsonData), 
        "{\"temp\":%.1f,\"hum\":%.1f,\"light\":%d}", t, h, lightValue);
      
      // ✅ ĐƠN GIẢN: Gửi đến topic cố định cho 1 ESP32
      client.publish("esp32/sensors", jsonData, false);
      errorCount = 0; // Reset counter khi OK
      
      // Hiển thị dữ liệu trên Serial Monitor
      Serial.printf("📊 Nhiệt độ: %.1f°C | Độ ẩm: %.1f%% | Ánh sáng: %d Lux | ❤️  Heartbeat\n",
                    t, h, lightValue);
    } else {
      errorCount++;
      Serial.printf("⚠️ Dữ liệu không hợp lệ: T=%.1f, H=%.1f, L=%d (Error #%d)\n", 
                     t, h, lightValue, errorCount);
      
      // ✅ ERROR HANDLING: Restart ESP32 nếu quá nhiều lỗi (với cooldown)
      if (errorCount >= MAX_ERRORS) {
        unsigned long now = millis();
        
        // Kiểm tra cooldown để tránh restart loop
        if (now - lastRestartTime > RESTART_COOLDOWN) {
          lastRestartTime = now;
          errorCount = 0; // Reset counter trước khi restart
          Serial.println("❌ Quá nhiều lỗi dữ liệu, reset ESP32");
          delay(1000); // Delay 1 giây trước khi restart
          ESP.restart();
        } else {
          Serial.printf("⏳ Restart cooldown active, waiting... (%lu ms remaining)\n", 
                       RESTART_COOLDOWN - (now - lastRestartTime));
        }
      }
    }

    // ✅ ĐƠN GIẢN: Gửi heartbeat cố định cho 1 ESP32
    client.publish("esp32/heartbeat", "alive", false);
    
    // ✅ TỐI ƯU: Reset error counter sau một khoảng thời gian
    resetErrorCounter();
  }
}

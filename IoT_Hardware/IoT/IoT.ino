#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>

// ========== CẤU HÌNH WIFI ==========
const char* ssid = "***REMOVED***";        // Tên mạng WiFi cần kết nối
const char* password = "***REMOVED***";   // Mật khẩu WiFi

// ========== CẤU HÌNH MQTT BROKER ==========
const char* mqtt_server = "192.168.180.176";  // Địa chỉ IP của MQTT broker (máy chủ)
const int mqtt_port = 1883;                   // Cổng MQTT (mặc định 1883)
const char* mqtt_user = "***REMOVED***";           // Tên đăng nhập MQTT
const char* mqtt_pass = "***REMOVED***";           // Mật khẩu MQTT

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
unsigned long lastMsg = 0;   // Lưu thời điểm gửi message cuối cùng (sử dụng unsigned long để tránh overflow)

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
  char topic[30];
  snprintf(topic, sizeof(topic), "esp32/%s", device);  // Tạo topic: esp32/dieuhoa, esp32/quat, esp32/den
  
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
    snprintf(fullTopic, sizeof(fullTopic), "esp32/%s", devices[i].topicSuffix);
    
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
      
      // Subscribe các topic điều khiển
      client.subscribe("esp32/dieuhoa");
      client.subscribe("esp32/quat");
      client.subscribe("esp32/den");
      Serial.println("📥 Đã subscribe: esp32/dieuhoa, esp32/quat, esp32/den");
      
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

// ========== HÀM SETUP (CHẠY 1 LẦN KHI KHỞI ĐỘNG) ==========
// - Kết nối WiFi
// - Kết nối MQTT broker
// - Cấu hình cảm biến DHT11 và ADC
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
    reconnect();
  }
  client.loop();  // Xử lý các message MQTT đến

  unsigned long now = millis();
  
  // Gửi dữ liệu cảm biến mỗi 1 giây (1000ms)
  if (now - lastMsg >= 1000) {
    lastMsg = now;

    // ========== ĐỌC CẢM BIẾN DHT11 ==========
    float h = dht.readHumidity();       // Đọc độ ẩm (%)
    float t = dht.readTemperature();    // Đọc nhiệt độ (°C)

    // ========== ĐỌC CẢM BIẾN ÁNH SÁNG LDR ==========
    // Đảo ngược giá trị ADC vì LDR cho giá trị cao khi tối
    uint16_t rawLight = analogRead(LDR_PIN);
    uint16_t lightValue = map(rawLight, 0, adcMaxValue, adcMaxValue, 0);

    // ========== GỬI DỮ LIỆU LÊN MQTT ==========
    // Chỉ gửi nhiệt độ và độ ẩm nếu đọc thành công (không NaN)
    if (!isnan(h) && !isnan(t)) {
      char tempStr[10], humStr[10];
      dtostrf(t, 4, 2, tempStr);  // Chuyển float sang string (tiết kiệm RAM)
      dtostrf(h, 4, 2, humStr);
      
      client.publish("esp32/temperature", tempStr, false);
      client.publish("esp32/humidity", humStr, false);
    }
    
    // Gửi giá trị ánh sáng
    char lightStr[10];
    itoa(lightValue, lightStr, 10);
    client.publish("esp32/light", lightStr, false);

    // Gửi heartbeat để backend biết ESP32 còn hoạt động
    client.publish("esp32/heartbeat", "alive", false);

    // Hiển thị dữ liệu trên Serial Monitor
    Serial.printf("📊 Nhiệt độ: %.1f°C | Độ ẩm: %.1f%% | Ánh sáng: %d Lux | ❤️  Heartbeat\n",
                  t, h, lightValue);
  }
}

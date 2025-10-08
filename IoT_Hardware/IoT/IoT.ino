#include <WiFi.h> // Thư viện WiFi cho ESP32
#include <PubSubClient.h> // Thư viện MQTT client
#include <DHT.h> // Thư viện cảm biến nhiệt độ và độ ẩm
#include <math.h> // Thư viện toán học

// ===== WiFi =====
// Cấu hình WiFi
const char* ssid = "***REMOVED***"; // Tên mạng WiFi
const char* password = "***REMOVED***"; // Mật khẩu WiFi

// ===== MQTT Broker =====
// Cấu hình MQTT broker
const char* mqtt_server = "192.168.180.176"; // Địa chỉ IP MQTT broker
const int mqtt_port = 1883; // Port MQTT
const char* mqtt_user = "***REMOVED***"; // Tên đăng nhập MQTT
const char* mqtt_pass = "***REMOVED***"; // Mật khẩu MQTT

WiFiClient espClient; // Client WiFi
PubSubClient client(espClient); // Client MQTT

// ===== Cấu hình chân =====
// Định nghĩa các chân GPIO
#define DHTPIN 16 // Chân kết nối cảm biến DHT11
#define DHTTYPE DHT11 // Loại cảm biến DHT11
#define DIEUHOA 18 // Chân điều khiển điều hòa
#define QUAT 13 // Chân điều khiển quạt
#define DEN 26 // Chân điều khiển đèn
#define LDR_PIN 32 // Chân đọc cảm biến ánh sáng

DHT dht(DHTPIN, DHTTYPE); // Khởi tạo đối tượng DHT

long lastMsg = 0; // Thời gian tin nhắn cuối cùng

// Biến lưu độ phân giải ADC - Tối ưu memory
// Cấu hình ADC tối ưu
const int adcBits = 12;      // mặc định ESP32 = 12-bit
const int adcMaxValue = 4095; // Tính trước để tiết kiệm memory

// Biến lưu trạng thái thiết bị - Tối ưu memory
// Trạng thái các thiết bị sử dụng bit flags
uint8_t deviceStates = 0; // 8-bit: bit 0=den, bit 1=quat, bit 2=dieuhoa

// Helper functions cho device states
// Hàm tiện ích cho trạng thái thiết bị
bool getDeviceState(int device) { return (deviceStates >> device) & 1; }
void setDeviceState(int device, bool state) { 
  if (state) deviceStates |= (1 << device); 
  else deviceStates &= ~(1 << device); 
}

// Compatibility macros - Giữ tương thích với code cũ
#define dieuhoa_state getDeviceState(2)
#define quat_state getDeviceState(1) 
#define den_state getDeviceState(0)

// ===== Kết nối WiFi =====
// Hàm kết nối WiFi
void setup_wifi() {
  delay(10); // Đợi 10ms
  Serial.print("Đang kết nối WiFi: "); // In thông báo
  Serial.println(ssid); // In tên mạng WiFi

  WiFi.begin(ssid, password); // Bắt đầu kết nối WiFi
  while (WiFi.status() != WL_CONNECTED) { // Vòng lặp chờ kết nối
    delay(500); // Đợi 500ms
    Serial.print("."); // In dấu chấm
  }

  Serial.println("\nWiFi đã kết nối!");
  Serial.print("IP ESP32: ");
  Serial.println(WiFi.localIP());
}

// ===== Gửi phản hồi trạng thái thiết bị =====
void sendDeviceFeedback(String device, String state) {
  String topic = "esp32/" + device;
  client.publish(topic.c_str(), state.c_str());
  Serial.printf("📤 Gửi phản hồi: %s -> %s\n", topic.c_str(), state.c_str());
  
  // Delay nhỏ để đảm bảo message được gửi
  delay(100);
}

// ===== Callback khi nhận lệnh từ MQTT - Tối ưu memory =====
void callback(char* topic, byte* payload, unsigned int length) {
  // Tối ưu: Không dùng String, parse trực tiếp
  bool isOn = (length >= 2 && payload[0] == 'O' && payload[1] == 'N');
  
  // Tạo topic string tạm thời
  char topicStr[20];
  strncpy(topicStr, topic, sizeof(topicStr) - 1);
  topicStr[sizeof(topicStr) - 1] = '\0';
  
  Serial.printf("📩 Nhận từ [%s]: %s\n", topicStr, isOn ? "ON" : "OFF");

  // Tối ưu: Sử dụng lookup table thay vì nhiều if
  struct DeviceConfig {
    const char* topicSuffix;
    int pin;
    int deviceIndex;
    const char* name;
  };
  
  static const DeviceConfig devices[] = {
    {"dieuhoa", DIEUHOA, 2, "Điều hòa"},
    {"quat", QUAT, 1, "Quạt"},
    {"den", DEN, 0, "Đèn"}
  };
  
  // Tìm device tương ứng
  for (int i = 0; i < 3; i++) {
    char fullTopic[20];
    snprintf(fullTopic, sizeof(fullTopic), "esp32/%s", devices[i].topicSuffix);
    
    if (strcmp(topic, fullTopic) == 0) {
      bool currentState = getDeviceState(devices[i].deviceIndex);
      if (currentState != isOn) {
        digitalWrite(devices[i].pin, isOn ? HIGH : LOW);
        setDeviceState(devices[i].deviceIndex, isOn);
        Serial.printf("🔧 %s: %s\n", devices[i].name, isOn ? "BẬT" : "TẮT");
        
        // Gửi phản hồi
        sendDeviceFeedback(devices[i].topicSuffix, isOn ? "ON" : "OFF");
      } else {
        Serial.printf("⏭️ %s: Không thay đổi (đã %s)\n", devices[i].name, isOn ? "BẬT" : "TẮT");
      }
      break;
    }
  }
}

// ===== Kết nối lại MQTT nếu mất =====
void reconnect() {
  while (!client.connected()) {
    Serial.print("Đang kết nối MQTT...");
    
    // ✅ Thêm Last Will Testament để phát hiện mất kết nối ngay lập tức
    if (client.connect("ESP32Client", mqtt_user, mqtt_pass, 
                       "esp32/status", 1, true, "offline")) {
      Serial.println("OK!");
      
      // ✅ Publish trạng thái online ngay khi kết nối
      client.publish("esp32/status", "online", true);
      Serial.println("📤 Published status: online");
      
      // Subscribe các topic điều khiển
      client.subscribe("esp32/dieuhoa");
      client.subscribe("esp32/quat");
      client.subscribe("esp32/den");
      
      Serial.println("✅ Đã subscribe các topic điều khiển");
      
      // ✅ Gửi yêu cầu đồng bộ trạng thái từ database
      Serial.println("🔄 Gửi yêu cầu đồng bộ trạng thái...");
      client.publish("esp32/sync_request", "sync", false);
      
    } else {
      Serial.print("Thất bại, rc=");
      Serial.print(client.state());
      Serial.println(" -> thử lại sau 5s");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(DIEUHOA, OUTPUT);
  pinMode(QUAT, OUTPUT);
  pinMode(DEN, OUTPUT);

  // Khởi tạo tất cả thiết bị ở trạng thái TẮT
  digitalWrite(DIEUHOA, LOW);
  digitalWrite(QUAT, LOW);
  digitalWrite(DEN, LOW);

  dht.begin();
  setup_wifi();

  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);

  // Cấu hình ADC
  analogReadResolution(adcBits);           

  Serial.printf("ADC resolution: %d-bit, max value: %d\n", adcBits, adcMaxValue);
  Serial.println("🚀 ESP32 IoT Controller khởi động thành công!");
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  long now = millis();
  if (now - lastMsg > 1000) { // Gửi dữ liệu mỗi 1 giây để làm heartbeat
    lastMsg = now;

    float h = dht.readHumidity();
    float t = dht.readTemperature();

    // ==== Đọc ánh sáng và đảo ngược dựa vào max ADC ====
    int rawLight = analogRead(LDR_PIN);
    int lightValue = map(rawLight, 0, adcMaxValue, adcMaxValue, 0);

    if (!isnan(h) && !isnan(t)) {
      client.publish("esp32/temperature", String(t).c_str());
      client.publish("esp32/humidity", String(h).c_str());
    }
    client.publish("esp32/light", String(lightValue).c_str());

    // ✅ Gửi heartbeat để BE biết ESP32 còn sống
    // Gửi tín hiệu heartbeat để backend biết ESP32 còn hoạt động
    client.publish("esp32/heartbeat", "alive");

    // In dữ liệu ra Serial Monitor
    Serial.printf("📊 Temp: %.2f°C | Hum: %.2f%% | Light: %d | Heartbeat\n",
                  t, h, lightValue);
  }
}
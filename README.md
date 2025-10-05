bây giờ tôi sẽ nói yêu cầu của tôi về dự án 
- hiện tại ở actionhistory đang lưu trạng thái của cả 3 thiết bị cùng 1 lúc tôi chỉ muốn lưu cái nào được thao tác thôi còn cái nào không được thao tác thì không lưu lại 
- khi thao tác ON/OFF điều khiển thiết bị thì hiện tại đang là ở fe thao tác là be sẽ lưu vào database luôn nhưng tôi không muốn như vậy tôi chỉ muốn lưu khi mà esp 32 gửi dữ liệu lên be thì mới lưu còn xóa cái lưu ngay khi thao tác trên fe đi
- tôi muốn luồng xử lý hoạt động sẽ là thao ác on/off ở be -> be gửi lệnh đến mqtt -> mqtt gửi lệnh cho esp 32 thực hiện thao tác -> esp 32 thực hiện xong gửi lại mess thông báo trạng thái hiện tại của thiết bị cho mqtt -> mqtt gửi lên cho be -> be gửi lên cho fe đồng thời lưu dữ liệu thay đổi đó vào database trong khoảng thời gian chờ trạng thái được gửi lên thì ở fe nút thao tác sẽ có trạng thái xoay vòng (loading) chỉ có nút thao tác hiển thị trạng thái loading còn nút không thao tác vẫn sáng bình thường khi mà esp 32 đã gửi thông báo trạng thái mới lên và fe nhận được rồi thì lúc đó mới xóa trạng thái loading và sáng nút trạng thái mới lên còn nút trạng thái cũ mờ đi 
- ngay khi cắm thiết bị vào thì be sẽ gửi lệnh trạng thái gần nhất trước đó trong database(actionhistory) xuống cho mqtt mqtt gửi lệnh cho esp 32 mở đúng với trạng thái gần nhất của từng thiết bị trong database và gửi lại thông tin trạng thái thiết bị lên để fe hiển thị đúng trạng thái trước đó và trong khi chờ kết nối và gửi dữ liệu lên đó thì khu vực điều khiển thiết bị sẽ phải bị mờ đi và không thao tác được nhưng vẫn hiển thị trạng thái gần nhất 
- khi thiết bị bị rút ra hoặc mất kết nối với be thì khu vực điều khiển thiết bị sẽ phải bị mờ đi và không thao tác được nhưng vẫn hiển thị trạng thái gần nhất khi kết nối lại thành công thì lại sáng lại và có thể thao tác bình thường
- khi ấn refresh trên web thì trạng thái thiết bị cũng không được thay đổi
- đấy là toàn bộ yêu cầu của tôi về việc sửa lại dự án hãy đọc thật kỹ từng file lên cho tôi hướng giải quyết để tôi đọc và hãy sửa theo hướng đó đảm bảo đúng với yêu cầu và không xảy ra lỗi
- đây là code điều khiển esp 32 :
#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <math.h>

// ===== WiFi =====
const char* ssid = "***REMOVED***";
const char* password = "***REMOVED***";

// ===== MQTT Broker =====
const char* mqtt_server = "192.168.180.176";
const int mqtt_port = 1883;
const char* mqtt_user = "***REMOVED***";
const char* mqtt_pass = "***REMOVED***";

WiFiClient espClient;
PubSubClient client(espClient);

// ===== Cấu hình chân =====
#define DHTPIN 16
#define DHTTYPE DHT11
#define DIEUHOA 18
#define QUAT 13
#define DEN 26
#define LDR_PIN 32

DHT dht(DHTPIN, DHTTYPE);

long lastMsg = 0;

// Biến lưu độ phân giải ADC
const int adcBits = 12;      // mặc định ESP32 = 12-bit
int adcMaxValue = 0;         // sẽ được tính trong setup()

// Biến lưu trạng thái thiết bị
bool dieuhoa_state = false;
bool quat_state = false;
bool den_state = false;

// ===== Kết nối WiFi =====
void setup_wifi() {
  delay(10);
  Serial.print("Đang kết nối WiFi: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
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

// ===== Callback khi nhận lệnh từ MQTT =====
void callback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.printf("📩 Nhận từ [%s]: %s\n", topic, message.c_str());

  // Xử lý lệnh điều hòa
  if (String(topic) == "esp32/dieuhoa") {
    bool newState = (message == "ON");
    if (dieuhoa_state != newState) {
      digitalWrite(DIEUHOA, newState ? HIGH : LOW);
      dieuhoa_state = newState;
      Serial.printf("🔧 Điều hòa: %s\n", newState ? "BẬT" : "TẮT");
      
      // Gửi phản hồi sau khi thực hiện
      sendDeviceFeedback("dieuhoa", message);
    }
  }
  
  // Xử lý lệnh quạt
  if (String(topic) == "esp32/quat") {
    bool newState = (message == "ON");
    if (quat_state != newState) {
      digitalWrite(QUAT, newState ? HIGH : LOW);
      quat_state = newState;
      Serial.printf("🔧 Quạt: %s\n", newState ? "BẬT" : "TẮT");
      
      // Gửi phản hồi sau khi thực hiện
      sendDeviceFeedback("quat", message);
    }
  }
  
  // Xử lý lệnh đèn
  if (String(topic) == "esp32/den") {
    bool newState = (message == "ON");
    if (den_state != newState) {
      digitalWrite(DEN, newState ? HIGH : LOW);
      den_state = newState;
      Serial.printf("🔧 Đèn: %s\n", newState ? "BẬT" : "TẮT");
      
      // Gửi phản hồi sau khi thực hiện
      sendDeviceFeedback("den", message);
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
      Serial.println("🔄 Chờ backend sync trạng thái từ database...");
      
      // ✅ KHÔNG gửi trạng thái, chờ backend sync từ database
      
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
  adcMaxValue = pow(2, adcBits) - 1;       

  Serial.printf("ADC resolution: %d-bit, max value: %d\n", adcBits, adcMaxValue);
  Serial.println("🚀 ESP32 IoT Controller khởi động thành công!");
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  long now = millis();
  if (now - lastMsg > 2000) {
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

    Serial.printf("📊 Temp: %.2f°C | Hum: %.2f%% | Light: %d\n",
                  t, h, lightValue);
  }
}
 

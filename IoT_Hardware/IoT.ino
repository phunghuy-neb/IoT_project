#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <math.h>

// ===== WiFi =====
const char* ssid = "Neb Neee";
const char* password = "012345678";

// ===== MQTT Broker =====
const char* mqtt_server = "192.168.231.176";
const int mqtt_port = 1883;
const char* mqtt_user = "adminiot";
const char* mqtt_pass = "adminiot";

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

// ===== Callback khi nhận lệnh từ MQTT =====
void callback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.printf("Nhận từ [%s]: %s\n", topic, message.c_str());

  if (String(topic) == "esp32/dieuhoa") {
    digitalWrite(DIEUHOA, (message == "ON") ? HIGH : LOW);
  }
  if (String(topic) == "esp32/quat") {
    digitalWrite(QUAT, (message == "ON") ? HIGH : LOW);
  }
  if (String(topic) == "esp32/den") {
    digitalWrite(DEN, (message == "ON") ? HIGH : LOW);
  }
}

// ===== Kết nối lại MQTT nếu mất =====
void reconnect() {
  while (!client.connected()) {
    Serial.print("Đang kết nối MQTT...");
    if (client.connect("ESP32Client", mqtt_user, mqtt_pass)) {
      Serial.println("OK!");
      client.subscribe("esp32/dieuhoa");
      client.subscribe("esp32/quat");
      client.subscribe("esp32/den");
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

  dht.begin();
  setup_wifi();

  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);

  // Cấu hình ADC
  analogReadResolution(adcBits);           
  adcMaxValue = pow(2, adcBits) - 1;       

  Serial.printf("ADC resolution: %d-bit, max value: %d\n", adcBits, adcMaxValue);
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

    Serial.printf("Temp: %.2f°C | Hum: %.2f%% | Light: %d\n",
                  t, h, lightValue);
  }
}

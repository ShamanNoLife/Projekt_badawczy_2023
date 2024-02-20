#include <ESP8266WiFi.h>
#include <WiFiClient.h>
#include <ESP8266WiFiMulti.h>
#include <ESP8266mDNS.h>
#include <ESP8266WebServer.h>
#include <FS.h>  
#include <SPI.h>

/*MODULES*/

#define USING_TIM_DIV1                false           
#define USING_TIM_DIV16               true           
#define USING_TIM_DIV256              false           

#define LED D4
#define ADC A0
#define GSR 3
#define EMG 1
#define HEAT_RATE D2

#define TIMER_INTERVAL_MS       1000

#include "ESP8266TimerInterrupt.h"

int sensorValue=0;
int gsr_average=0;
int max_analog_dta=300;              
int min_analog_dta=100;              
int static_analog_dta=0; 
long int currenttime=0,previoustime=0;
long gsr=0,emg=0;

unsigned char counter;
unsigned long temp[21];
unsigned long sub;
bool data_effect=true;
bool flag_from_heart_rate=false;
unsigned int heart_rate=0;
const int max_heartpluse_duty = 2000;
volatile uint32_t lastMillis = 0;

/*ESP*/

ESP8266WiFiMulti wifiMulti;  

ESP8266WebServer server(80);  

const char *ssid = "karol"; 
const char *password = "karol123";

const char* mdnsName = "esp8266"; 

File fsUploadFile;

WiFiUDP UDP;

ESP8266Timer ITimer;

long get_data_from_gsr(int pin);
int get_data_from_emg(int pin);
void get_data_from_heart_rate();
void init_gpio_Trans();
void interrupt();
void arrayInit();
void startWiFi();
void startSPIFFS();
void startMDNS();
void startServer();
void startUDP();
void handleNotFound();
bool handleFileRead(String path);
void handleFileUpload();
String formatBytes(size_t bytes);
String getContentType(String filename);
void clearCSV();
void appendToCSV(int x, int y, int z);
void readAndPrintCSV();

void ICACHE_RAM_ATTR interrupt(){
   if(flag_from_heart_rate==false){
      flag_from_heart_rate=true;
    }
  }

void setup() {
  pinMode(LED, OUTPUT);
  init_gpio_Trans();
  startWiFi();                 
  startSPIFFS();
  clearCSV();               
  startMDNS();                 
  startServer();
  startUDP();
  ICACHE_RAM_ATTR;
  attachInterrupt(digitalPinToInterrupt(HEAT_RATE), interrupt, RISING);
}

int i=0,j;

void loop(void) {
  if(flag_from_heart_rate==true){
    MDNS.update();
    server.handleClient();
    get_data_from_heart_rate();
    flag_from_heart_rate=false;
  }
    MDNS.update();
    server.handleClient();
}

/*Modules GSR,EMG,HEAT RATE*/
long get_data_from_gsr(int pin){
  digitalWrite(GSR, HIGH);
  delay(1);
  long sum=0;
  for(int i=0;i<10;i++){
      sensorValue=analogRead(pin);
      sum += sensorValue;
      delay(5);
      }
   gsr_average = sum/10;
   delay(1);
   digitalWrite(GSR, LOW);
   return gsr_average;
}

int get_data_from_emg(int pin){
    digitalWrite(EMG, HIGH);
    delay(1);
    long sum = 0;
    for(int i=0; i<10; i++){
        sum += analogRead(pin);
    }
    delay(1);
    digitalWrite(EMG, LOW);        
    return (sum/10);
}

void get_data_from_heart_rate(){
  static int prevHeartRate=500;
  gsr=get_data_from_gsr(ADC);
  emg=get_data_from_emg(ADC);
  digitalWrite(LED,!digitalRead(LED)); 
  currenttime=millis();
  if(currenttime!=previoustime){
        heart_rate=60000/(currenttime-previoustime);
  }
  if(heart_rate>(prevHeartRate*14/10)){
  appendToCSV(prevHeartRate,gsr,emg);
  }
  else{
        appendToCSV(heart_rate,gsr,emg);
  }
  prevHeartRate=heart_rate;
  previoustime=currenttime;
}

void arrayInit(){
  for(unsigned char i=0;i < 20;i ++)
  {
   temp[i]=0;
  }
  temp[20]=millis();
}

/*ESP AND SD MODULE*/

void init_gpio_Trans(){
 pinMode(GSR, OUTPUT);
 pinMode(EMG, OUTPUT);
 digitalWrite(GSR, LOW);
 digitalWrite(EMG, LOW);
  }

void startWiFi() { 
  WiFi.softAP(ssid, password);             
  Serial.print("access point \"");
  Serial.print(ssid);
  Serial.println("\" started");

  Serial.print("IP address:\t");
  Serial.println(WiFi.softAPIP());
}

void startSPIFFS() { 
  SPIFFS.begin();                             
  Serial.println("SPIFFS started. Contents:");
  {
    Dir dir = SPIFFS.openDir("/");
    while (dir.next()) {                      
      String fileName = dir.fileName();
      size_t fileSize = dir.fileSize();
      Serial.printf("\tFS File: %s, size: %s\r\n", fileName.c_str(), formatBytes(fileSize).c_str());
    }
    Serial.printf("\n");
  }
}

void startMDNS() { 
  MDNS.begin(mdnsName);                        
  Serial.print("mDNS responder started: http:");
  Serial.print(mdnsName);
  Serial.println(".local");
}

void startServer() { 
  server.on("/edit.html",  HTTP_POST, []() {  
    server.send(200, "text/plain", "");
  }, handleFileUpload);                       

  server.onNotFound(handleNotFound);          
 
  server.begin();                             
  Serial.println("HTTP server started.");
}

void startUDP() {
 Serial.println("Starting UDP");
 UDP.begin(123);                          
 Serial.print("Local port:\t");
 Serial.println(UDP.localPort());
}

void handleNotFound() { 
  if (!handleFileRead(server.uri())) {        
    server.send(404, "text/plain", "404: File Not Found");
  }
}

bool handleFileRead(String path){  
  Serial.println("handleFileRead: " + path);
  if(path.endsWith("/")) path += "main.html";           
  String contentType = getContentType(path);             
  String pathWithGz = path + ".gz";
  if(SPIFFS.exists(pathWithGz) || SPIFFS.exists(path)){  
    if(SPIFFS.exists(pathWithGz))                          
      path += ".gz";                                         
    File file = SPIFFS.open(path, "r");                    
    size_t sent = server.streamFile(file, contentType);    
    file.close();                                          
    Serial.println(String("\tSent file: ") + path);
    return true;
  }
  Serial.println(String("\tFile Not Found: ") + path);
  return false;                                          
}

void handleFileUpload() { 
  HTTPUpload& upload = server.upload();
  String path;
  if (upload.status == UPLOAD_FILE_START) {
    path = upload.filename;
    if (!path.startsWith("/")) path = "/" + path;
    if (!path.endsWith(".gz")) {                         
      String pathWithGz = path + ".gz";                  
      if (SPIFFS.exists(pathWithGz))                     
        SPIFFS.remove(pathWithGz);
    }
    Serial.print("handleFileUpload Name: "); 
    Serial.println(path);
    fsUploadFile = SPIFFS.open(path, "w");               
    path = String();
  } else if (upload.status == UPLOAD_FILE_WRITE) {
    if (fsUploadFile)
      fsUploadFile.write(upload.buf, upload.currentSize); 
  } else if (upload.status == UPLOAD_FILE_END) {
    if (fsUploadFile) {                                   
      fsUploadFile.close();                               
      Serial.print("handleFileUpload Size: "); 
      Serial.println(upload.totalSize);     
      server.send(303);
    } else {
      server.send(500, "text/plain", "500: couldn't create file");
    }
  }
}

String formatBytes(size_t bytes) { 
  if (bytes < 1024) {
    return String(bytes) + "B";
  } else if (bytes < (1024 * 1024)) {
    return String(bytes / 1024.0) + "KB";
  } else if (bytes < (1024 * 1024 * 1024)) {
    return String(bytes / 1024.0 / 1024.0) + "MB";
  }
  return "0";
}

String getContentType(String filename){
  if(filename.endsWith(".html")) return "text/html";
  else if(filename.endsWith(".css")) return "text/css";
  else if(filename.endsWith(".js")) return "application/javascript";
  else if(filename.endsWith(".gz")) return "application/x-gzip";
  return "text/plain";
}

void clearCSV() {
  File datalog = SPIFFS.open("/data.csv", "w");

  if (!datalog) {
    Serial.println("Failed to open data.csv for clearing");
    return;
  }
  datalog.truncate(0);
  datalog.close();
}

void appendToCSV(int x, int y, int z) {
  File datalog = SPIFFS.open("/data.csv", "a");
  
  if (!datalog) {
    Serial.println("Failed to open data.csv for appending");
    return;
  }
  else{
    Serial.println("Success to open data.csv for appending");
    }
  datalog.print(x);
  datalog.print(',');
  datalog.print(y);
  datalog.print(',');
  datalog.println(z);
  datalog.close();

}

void readAndPrintCSV() {
  File datalog = SPIFFS.open("/data.csv", "r");
  if (!datalog) {
    Serial.println("Failed to open data.csv for reading");
    return;
  }
  
  while (datalog.available()) {
    String line = datalog.readStringUntil('\n');
    Serial.println(line);
  }

  datalog.close();
}

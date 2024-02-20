#include <ESP8266WiFi.h>
#include <WiFiClient.h>
#include <ESP8266WiFiMulti.h>
#include <ESP8266mDNS.h>
#include <ESP8266WebServer.h>
#include <FS.h>  
#include <SPI.h>
#include <SD.h>

/*MODULES*/

const int ADC=A0, GSR=3,EMG=1,HEAT_RATE=16  ;
int sensorValue=0;
int gsr_average=0;

int max_analog_dta=300;              
int min_analog_dta=100;              
int static_analog_dta=0; 

long gsr=0,emg=0;

unsigned char counter;
unsigned long temp[21];
unsigned long sub;
bool data_effect=true;
unsigned int heart_rate=0;
const int max_heartpluse_duty = 2000;

const int chipSelect = 15;

/*ESP*/

ESP8266WiFiMulti wifiMulti;  

ESP8266WebServer server(80);  

const char* mdnsName = "esp8266"; 

File fsUploadFile;

WiFiUDP UDP;

String getContentType(String filename);  
bool handleFileRead(String path);        
void ICACHE_RAM_ATTR interrupt();
void readAndPrintCSV();


void setup() {
  Serial.begin(9600);
  Serial.swap();
  delay(10);
  
  pinMode(GSR, OUTPUT);
  pinMode(EMG, OUTPUT);

  if (!SD.begin(chipSelect)) {
    Serial.println("SD card initialization failed. Check your connections.");
    return;
  }
  Serial.println("SD card initialized successfully.");
  SD.remove("/data.csv");
  
  startWiFi();                 
  startSPIFFS();
  clearCSV();               
  startMDNS();                 
  startServer();
  startUDP();

  attachInterrupt(HEAT_RATE, interrupt, RISING);
}

int i=0,j=0;

void loop(void) {
  digitalWrite(EMG, LOW);
  digitalWrite(GSR, LOW);
  delay(1000);
  digitalWrite(EMG, HIGH);
  digitalWrite(GSR, HIGH);
  if(j<=100){ 
     heart_rate=i*10;
     gsr=i+1*100;
     emg=i+2; 
     appendToCSV(gsr,emg,heart_rate);
     i++;
     j++;
  }
  else{
    readAndPrintCSV();
   }
  MDNS.update();
  server.handleClient();
}

/*Modules GSR,EMG,HEAT RATE*/
long get_data_from_gsr(int pin){
  digitalWrite(GSR, HIGH);
  delay(50);
  long sum=0;
  for(int i=0;i<10;i++){
      sensorValue=analogRead(pin);
      sum += sensorValue;
      delay(5);
      }
   gsr_average = sum/10;
   delay(50);
   digitalWrite(GSR, LOW);
   return gsr_average;
}

int get_data_from_emg(int pin){
    digitalWrite(EMG, HIGH);
    delay(50);
    long sum = 0;
    for(int i=0; i<32; i++){
        sum += analogRead(pin);
    }
    int dta = sum>>5;
    max_analog_dta = dta>max_analog_dta ? dta : max_analog_dta;         
    min_analog_dta = min_analog_dta>dta ? dta : min_analog_dta; 
    delay(50);
    digitalWrite(EMG, LOW);        
    return sum>>5;
}

void sum(){
  if(data_effect){
   heart_rate=1200000/(temp[20]-temp[0]);
   gsr=get_data_from_gsr(ADC);
   emg=get_data_from_emg(ADC);
   File datalog = SPIFFS.open("/data.csv", "a");
   if (!datalog) {
    Serial.println("Failed to open data.csv for appending");
    return;
   }
   else{
    Serial.println("Success to open data.csv for appending");
   } 
  appendToCSV(heart_rate,gsr,emg);
  }
  data_effect=1;
}

void ICACHE_RAM_ATTR interrupt(){
  temp[counter]=millis();
  switch(counter){
    case 0:
     sub=temp[counter]-temp[20];
     break;
     default:
     sub=temp[counter]-temp[counter-1];
     break;
  }
  if(sub>max_heartpluse_duty){
            data_effect=0;
            counter=0;
  Serial.println("Heart rate measure error,test will restart!" );
  arrayInit();
  }
  if (counter==20&&data_effect){
      counter=0;
      sum();
  }
  else if(counter!=20&&data_effect)
  counter++;
  else {
    counter=0;
    data_effect=1;
  }      
}

void arrayInit(){
  for(unsigned char i=0;i < 20;i ++)
  {
   temp[i]=0;
  }
  temp[20]=millis();
}

/*ESP*/

const char *ssid = "karol"; 
const char *password = "karol123";

void startWiFi() { 
  /*
  wifiMulti.addAP("karol", "karol123");   
  wifiMulti.addAP("ssid_from_AP_2", "your_password_for_AP_2");
  wifiMulti.addAP("ssid_from_AP_3", "your_password_for_AP_3");

  Serial.println("Connecting");
  while (wifiMulti.run() != WL_CONNECTED) {  
    delay(250);
    Serial.print('.');
  }
  Serial.println("\r\n");
  Serial.print("Connected to ");
  Serial.println(WiFi.SSID());             
  Serial.print("IP address:\t");
  Serial.print(WiFi.localIP());            
  Serial.println("\r\n");
  */
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
    server.streamFile()
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
  File datalogSD = SD.open("/data.csv", FILE_WRITE);
  
  if (!datalog) {
    Serial.println("Failed to open data.csv for appending");
    return;
  }
  else{
    Serial.println("Success to open data.csv for appending");
    }

  if (!datalogSD) {
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

  datalogSD.print(x);
  datalogSD.print(',');
  datalogSD.print(y);
  datalogSD.print(',');
  datalogSD.println(z);
  datalogSD.close();
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

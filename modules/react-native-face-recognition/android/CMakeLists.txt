project(FaceRecognizer)
cmake_minimum_required(VERSION 3.9.0)

set(PACKAGE_NAME FaceRecognizer)
set(CMAKE_VERBOSE_MAKEFILE ON)
set(CMAKE_CXX_STANDARD 20)

add_compile_options(-DRN_SERIALIZABLE_STATE=1)

add_library(
  ${PACKAGE_NAME}
  SHARED
  src/main/cpp/cpp-adapter.cpp
  src/main/cpp/AndroidModelLoader.cpp
  ../cpp/bridge/HybridObjectDetector.cpp
  ../cpp/bridge/HybridObjectDetectorFactory.cpp
  ../cpp/detection/DetectorSession.cpp
  ../cpp/detection/YoloxDecoder.cpp
  ../cpp/engine/FaceEngine.cpp
  ../cpp/engine/FaceEngineConfig.cpp
  ../cpp/engine/FaceEngineProfiling.cpp
  ../cpp/frame/FrameSampler.cpp
  ../cpp/runtime/BufferMemory.cpp
  ../cpp/runtime/FaceEngineSession.cpp
  ../cpp/runtime/ModelFile.cpp
)

if(FACE_RECOGNIZER_PROFILE_RELEASE)
  target_compile_definitions(${PACKAGE_NAME} PRIVATE FACE_RECOGNIZER_PROFILE_RELEASE=1)
endif()

include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/FaceRecognizer+autolinking.cmake)

include_directories(
  "src/main/cpp"
  "../cpp"
  "../cpp/bridge"
  "../cpp/detection"
  "../cpp/engine"
  "../cpp/frame"
  "../cpp/geometry"
  "../cpp/runtime"
)

set(ORT_ROOT "${CMAKE_SOURCE_DIR}/../third_party/onnxruntime/android")
add_library(onnxruntime SHARED IMPORTED)
set_target_properties(
  onnxruntime
  PROPERTIES
  IMPORTED_LOCATION "${ORT_ROOT}/${ANDROID_ABI}/libonnxruntime.so"
  INTERFACE_INCLUDE_DIRECTORIES "${ORT_ROOT}/headers"
)

find_library(LOG_LIB log)
find_package(react-native-vision-camera REQUIRED)

target_link_libraries(
  ${PACKAGE_NAME}
  ${LOG_LIB}
  android
  onnxruntime
  react-native-vision-camera::VisionCamera
)

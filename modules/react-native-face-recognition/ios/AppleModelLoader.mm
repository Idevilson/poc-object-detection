#import <Foundation/Foundation.h>

#include "ModelLoader.hpp"

#include <stdexcept>
#include <string>

namespace margelo::nitro::facerecognizer {
namespace {

std::string bundledModelPath(NSString* name) {
  NSString* path = [[NSBundle mainBundle] pathForResource:name ofType:@"onnx"];
  if (path == nil) {
    throw std::runtime_error("FaceRecognizer could not find bundled model '" +
                             std::string(name.UTF8String) +
                             ".onnx' in the app bundle.");
  }
  return std::string(path.UTF8String);
}

}  // namespace

std::string bundledDetectorModelPath() {
  return bundledModelPath(@"yolox_nano");
}

}  // namespace margelo::nitro::facerecognizer

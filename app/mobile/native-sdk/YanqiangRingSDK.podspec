Pod::Spec.new do |s|
  s.name = 'YanqiangRingSDK'
  s.version = '1.0.0'
  s.summary = 'Yanqiang RingSDK bridge for Recording Ring'
  s.homepage = 'https://example.invalid/recording-ring'
  s.license = { :type => 'Proprietary', :text => 'Vendor SDK - internal use only' }
  s.author = { 'Recording Ring' => 'dev@localhost' }
  s.source = { :path => '.' }
  s.platform = :ios, '15.1'

  s.source_files = 'ios/**/*.{h,m,mm,swift}'
  s.public_header_files = 'ios/**/*.h'
  s.vendored_frameworks = 'RingSDK.framework', 'AB_FOTA.framework'
  s.frameworks = 'Foundation', 'CoreBluetooth', 'CoreServices', 'ExternalAccessory', 'QuartzCore', 'UIKit', 'AVFoundation', 'AudioToolbox'
  s.libraries = 'c++', 'sqlite3', 'z'
  s.dependency 'React-Core'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'CLANG_ENABLE_MODULES' => 'YES'
  }
end

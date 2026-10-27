Pod::Spec.new do |s|
  s.name           = 'MajlisCar'
  s.version        = '0.1.0'
  s.summary        = 'Car integration: now-playing session for Majlis'
  s.description    = 'Owns the audio session outside React so the lock screen and CarPlay can drive it.'
  s.author         = 'Tarek Eldeeb'
  s.homepage       = 'https://github.com/tarekeldeeb/majlis'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :path => '.' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'AVFoundation', 'CarPlay', 'MediaPlayer'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,mm,swift}'
end

Pod::Spec.new do |s|
  s.name = 'MoveGoalModule'
  s.version = '1.0.0'
  s.summary = 'On-demand Apple Move goal import for personal activity goals.'
  s.author = 'SparkyRivals'
  s.homepage = 'https://github.com/ImJstNickDev/SparkyRivals'
  s.platforms = { :ios => '15.1' }
  s.source = { git: '' }
  s.static_framework = true
  s.frameworks = 'HealthKit'
  s.license = 'AGPL-3.0'
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end

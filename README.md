# space-junk

## Notes
### Propagation Performance Test Results
10k iterations
```
* Orb.js       = 12, 13, 11 (12 avg)
* Satellite.js = 19, 22,  8 (16 avg)
* Pure Native  = 14, 16, 14 (15 avg)
* Native       = 25, 26, 22 (24 avg)
^ One native call per iteration
```

### Images to Video ffmpeg
```
ffmpeg -framerate 60 -i ./img%04d.png -c:v libx264 -pix_fmt yuv420p ./output.mp4
```
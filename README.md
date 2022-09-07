@[TOC](基于 WASM 的 H265 Web 播放器)

### 1 背景

目前这个时间点，原生支持 H265(HEVC)播放的浏览器极少，可以说基本没有，主要原因一个是 H265 的解码有更高的性能要求，从而换取更高的压缩率，目前大多数机器 CPU 软解 H265 的超清视频还是有点吃力，硬解兼容性又不好，另外一个原因主要是 H265 的专利费问题。因此 H265 有被各大浏览器厂商放弃的趋势，转而去支持更加开放的 AV1 编码，但是 AV1 编码的商用和普及估计还有段时间。

H265 与 H264 相比主要的好处在于相同分辨率下降低了几乎一倍的码率，对带宽压力比较大的网站来说，使用 H265 可以极大削减带宽消耗(尽管可能面临专利费麻烦)，但是由于浏览器的支持问题，目前 H265 的播放主要在 APP 端实现，借助硬件解码，可以获得比较好的性能和体验。

本文相关的代码使用 WASM、FFmpeg、WebGL、Web Audio 等组件实现了一个简易的支持 H265 的 Web 播放器，作为探索、验证，just for fun。

### 2 依赖

#### 2.1 WASM

WASM 的介绍在这里，可以在浏览器里执行原生代码(例如 C、C++)，要开发可以在浏览器运行的原生代码，需要安装他的工具链，我使用的是目前最新的版本(1.39.5)。编译环境有 Ubuntu、MacOS 等，这里有介绍。

#### 2.2 FFmpeg

主要使用 FFmpeg 来做解封装(demux)和解码(decoder)，由于使用了 FFmpeg(3.3)，理论上可以播放绝大多数格式的视频，这里只针对 H265 编码、MP4 封装，在编译时可以只按需编译最少的模块，从而得到比较小的库。

使用 Emscripten 编译 FFmpeg 主要参考下面这个网页，做了一些修改： https://blog.csdn.net/Jacob_job/article/details/79434207

#### 2.3 WebGL

H5 使用 Canvas 来绘图，但是默认的 2d 模式只能绘制 RGB 格式，使用 FFmpeg 解码出来的视频数据是 YUV 格式，想要渲染出来需要进行颜色空间转换，可以使用 FFmpeg 的 libswscale 模块进行转换，为了提升性能，这里使用了 WebGL 来硬件加速，主要参考了这个项目，做了一些修改： https://github.com/p4prasoon/YUV-Webgl-Video-Player

#### 2.4 Web Audio

FFmpeg 解码出来的音频数据是 PCM 格式，可以使用 H5 的 Web Audio Api 来播放，主要参考了这个项目，做了一些修改： https://github.com/samirkumardas/pcm-player

### 3 播放器实现

这里只是简单实现了播放器的部分功能，包括下载、解封装、解码、渲染、音视频同步等基本功能，每个环节还有很多细节可以优化。目前可以支持 FFmpeg 的各种内置 codec，如 H264/H265 等，默认支持 MP4/FLV 文件播放、HTTP-FLV 流的播放。

#### 3.1 模块结构

在这里插入图片描述

#### 3.2 线程模型

理论上来说，播放器应该使用这样的线程模型，各个模块在各自线程各司其职： 在这里插入图片描述 但是 WASM 目前对多线程(pthread)的支持不够好，各个浏览器的 WASM 多线程支持还处于试验阶段，因此现在最好不要在原生代码里编写 pthread 的代码。这里使用了 Web Worker，把下载和对 FFmpeg 的调用放到单独的线程中去。

主要有三个线程：

主线程(Player)：界面控制、播放控制、下载控制、音视频渲染、音视频同步；
解码线程(Decoder Worker)：音视频数据的解封装、解码；
下载线程(Downloader Worker)：下载某个 chunk。 线程之间通过 postMessage 进行异步通信，在需要传输大量数据(例如视频帧)的地方，需要使用 Transferable 接口来传输，避免大数据的拷贝损耗性能。

#### 3.3 Player

##### 3.3.1 接口

play：开始播放；
pause：暂停播放；
resume：恢复播放；
stop：停止播放；
fullscreen：全屏播放；
seek：seek 播放未实现。

##### 3.3.2 下载控制

为防止播放器无限制地下载文件，在下载操作中占用过多的 CPU，浪费过多带宽，这里在获取到文件码率之后，以码率一定倍数的速率下载文件。

##### 3.3.3 缓冲控制

缓存控制对这个播放器的意义重大，在这个时间点，WASM 还无法使用多线程以及多线程的同步，FFmpeg 的同步读数据接口必须保证返回数据。所以这里有两个措施，1：在未获取到文件元信息之前的数据缓存；2：解码帧缓存。必须控制好这两个缓存，才能保证任何时候 FFmpeg 需要读取数据时都能够返回数据，在数据不足时停止解码，进入 Buffer 状态，数据足够时继续解码播放，返回 Play 状态，保证 FFmpeg 不会报错退出播放。

##### 3.3.4 音视频同步

音频数据直接喂给 Web Audio，通过 Web Audio 的 Api 可以获得当前播放的音频的时间戳，以该时间戳为时间基准来同步视频帧，如果当前视频帧的时间已经落后则立刻渲染，如果比较早，则需要 delay。 在 H5 里 delay 可以通过 setTimeout 实现(还未找到更好的方式)，上面做缓冲控制的另外一个意义在于控制视频的渲染频率，如果调用 setTimeout 的视频帧太多，内存会暴涨。

##### 3.3.5 渲染

简单地将 PCM 数据交给 PCM Player，YUV 数据交给 WebGL Player。

#### 3.4 Downloader

这个模块很简单，只是单纯为了不在主线程做太多事情而分离，功能主要有：

通过 Content-Length 字段获取文件的长度；
通过 Range 字段下载一个 chunk。
如上面提到的，Player 会进行速率控制，因此需要把文件分成 chunk，按照 chunk 方式进行下载。下载的数据先发给 Player，由 Player 转交给 Decoder(理论上应该直接交给 Decoder，但是 Downloader 无法直接与 Decoder 通信)。 对流式的数据，则使用 Fetch。

##### 3.5 Decoder

这个模块需要加载原生代码生成的胶水代码(glue code)，胶水代码会加载 wasm。

self.importScripts("libffmpeg.js");

###### 3.5.1 接口

- initDecoder：初始化解码器，开辟文件缓存；
- uninitDecoder：反初始化解码器；
- openDecoder：打开解码器，获取文件信息；
- closeDecoder：关闭解码器；
- startDecoding：开始解码；
- pauseDecoding：暂停解码。

这些方法都由 Player 模块通过 postMessage 异步调用。

##### 3.5.2 缓存

这里简单使用了 WASM 的 MEMFS 文件接口(WASM 的文件系统参考)，使用方式就是直接调用 stdio 的方法，然后在 emcc 的编译命令中加入编译选项：

-s FORCE_FILESYSTEM=1
MEMFS 会在内存中虚拟一个文件系统，Decoder 收到 Player 发过来的文件数据直接写入缓存，由解码任务读取缓存。 对流式的数据，则使用 FFmpeg 的环形缓存 FIFO。

##### 3.5.3 解码

播放开始后不能立刻打开解码器，因为 FFmpeg 探测数据格式需要一定的数据长度(例如 MP4 头的长度)；
缓存的数据足够后 Player 打开解码器，会得到音频的参数(通道数、采样率、采样大小、数据格式)，视频的参数(分辨率，duration、颜色空间)，以这些参数来初始化渲染器、界面；
Player 调用 startDecoding 会启动一个定时器执行解码任务，以一定的速率开始解码；
Player 缓存满后会调用 pauseDecoding 暂停解码器。
4.5.4 数据交互
解码后的数据直接通过 Transferable Objects postMessage 给 Player，这样传递的是引用，不需要拷贝数据，提高了性能。

Javascript 与 C 的数据交互：

```
发送：
……
this.cacheBuffer = Module._malloc(chunkSize);
……
Decoder.prototype.sendData = function (data) {
    var typedArray = new Uint8Array(data);
    Module.HEAPU8.set(typedArray, this.cacheBuffer); //拷贝
    Module._sendData(this.cacheBuffer, typedArray.length); //传递
};

接收：
this.videoCallback = Module.addFunction(function (buff, size, timestamp) {
    var outArray = Module.HEAPU8.subarray(buff, buff + size); //拷贝
    var data = new Uint8Array(outArray);
    var objData = {
        t: kVideoFrame,
        s: timestamp,
        d: data
    };
    self.postMessage(objData, [objData.d.buffer]); //发送给Player
});
需要把回调通过openDecoder方法传入C层，在C层调用。
```

### 4 编译

#### 4.1 安装 Emscripten

参考其官方文档。

#### 4.2 编译

需要再 linux 环境下编译
进入代码目录，执行：

./src/build_decoder.sh

### 5 测试

```
npm install

npm run build

npm run dev
```

### 6 浏览器支持

目前(20190207)没有做太多严格的浏览器兼容性测试，主要在 Chrome 上开发，以下浏览器比较新的版本都可以运行：

Chrome(360 浏览器、搜狗浏览器等 webkit 内核也支持)；
Firefox；
Edge。

### 7 主要问题

解码、播放 H265 的 CPU 占用相对来说较高；
如果不及时传递音频数据，AudioContext 的 currentTime 不做控制可能会导致音视频不同步。

### 属性和接口说明

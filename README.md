# UhyomanCollectiveIndustries  
## Uhyoman_RPG  
### README  
うひょまんRPGは、うひょまんコレクティブインダストリーズが開発した、ブラウザベースのロールプレイングゲームです。  
## ゲームの特徴  
wiz likeなゲームで、プレイヤーは様々なロケーションを探索し、モンスターと戦い、アイテムを収集します。  
  
## 開発環境  
Windows 11 (25H2)  
  
## IDEとtools  
- Visual Studio Code  
- copilot(Claude)  
  
# 使用技術  
- JavaScript (ES6+)  
- HTML5  
- CSS3  
- vite  
- three.js  

# ファイル構成  
``` cmd
├───assets
│   └───Reference_image
├───css
├───data
├───js
│   └───ui
└───public
    ├───3Dobject_data
    │   ├───castle
    │   │   └───maps
    │   │       ├───Variation-Brown_Bricks
    │   │       ├───Variation-Dark_Bricks
    │   │       ├───Variation-Old_Bricks
    │   │       └───Variation_Light_Bricks
    │   ├───inn
    │   └───store
    ├───data
    └───dungeon_texture
        └───1
```

# 既知の問題点  
- 3Dobjectがアセットのままであり、それを表示し続けているので、そちらの修正が必要。  
- ロケーションの雰囲気を表現するための背景が未実装。  
- キャラクターを作成しても、反映されない。  
- 画面上のUIが未実装。  
- MAPが二階までしかない。  
- モンスターの画像がない  
- アイテムや武器、魔法の実装がまだである。  
- プレイヤーのステータスや経験値、レベルアップのシステムが未実装。  
- ゲームの進行に伴うイベントやストーリーの実装がまだである。  
- ゲームのセーブとロードの機能が未実装。  
- ゲームのバランス調整が必要。  
- wasdの移動が反転している。  


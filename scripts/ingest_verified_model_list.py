"""
Ingest verified model links, target folders, and custom target filenames.
Updates master-model-list.txt, workflowsData.json, and Supabase DB tables.
"""
import os
import re
import json
import psycopg2

VERIFIED_LIST_TEXT = """
# ==========================================
# CHECKPOINTS
# ==========================================
https://huggingface.co/Comfy-Org/ACE-Step_ComfyUI_repackaged/resolve/main/all_in_one/ace_step_v1_3.5b.safetensors checkpoints
https://huggingface.co/Comfy-Org/flux1-kontext-dev_ComfyUI/resolve/main/split_files/diffusion_models/flux1-dev-kontext_fp8_scaled.safetensors checkpoints
https://huggingface.co/Comfy-Org/stable-diffusion-3.5-fp8/resolve/main/sd3.5_large_fp8_scaled.safetensors checkpoints
https://huggingface.co/GraydientPlatformAPI/blendermix2/resolve/main/unet/diffusion_pytorch_model.safetensors checkpoints blendermix_v20.safetensors
https://huggingface.co/Kijai/SUPIR_pruned/resolve/main/SUPIR-v0F_fp16.safetensors checkpoints
https://huggingface.co/Lightricks/LTX-2/resolve/main/ltx-2-19b-dev-fp8.safetensors checkpoints
https://huggingface.co/Lykon/AbsoluteReality/resolve/main/AbsoluteReality_1.8.1_pruned.safetensors checkpoints
https://huggingface.co/alexgenovese/reica_models/resolve/021e192bd744c48a85f8ae1832662e77beb9aac7/realvisxlV40_v40LightningBakedvae.safetensors checkpoints
https://huggingface.co/comfyuistudio/AnimeNsfw/resolve/main/mistoonAnime_ponyAlpha.safetensors checkpoints
https://huggingface.co/comfyuistudio/realism-sdxl/resolve/main/realism-sdxl.safetensors checkpoints
https://huggingface.co/comfyuistudio/sketchit/resolve/main/sketch-sdxl.safetensors checkpoints
https://huggingface.co/cyberdelia/CyberRealisticPony/resolve/main/CyberRealisticPony_V14.1_FP16.safetensors checkpoints
https://huggingface.co/stabilityai/stable-video-diffusion-img2vid-xt/resolve/main/svd_xt.safetensors checkpoints
https://huggingface.co/tencent/Hunyuan3D-2/resolve/main/hunyuan3d-dit-v2-0/model.fp16.safetensors checkpoints hunyuan3d-dit-v2.safetensors

# ==========================================
# DIFFUSION & UNET MODELS
# ==========================================
https://huggingface.co/1038lab/Qwen-Image-Edit-2511-FP8/resolve/main/Qwen-Image-Edit-2511-FP8_e4m3fn.safetensors diffusion_models
https://huggingface.co/Comfy-Org/ERNIE-Image/resolve/main/diffusion_models/ernie-image-turbo.safetensors diffusion_models
https://huggingface.co/Comfy-Org/HiDream-I1_ComfyUI/resolve/main/split_files/diffusion_models/hidream_i1_fast_fp8.safetensors diffusion_models
https://huggingface.co/Comfy-Org/Ideogram-4/resolve/main/diffusion_models/ideogram4_fp8_scaled.safetensors diffusion_models
https://huggingface.co/Comfy-Org/Ideogram-4/resolve/main/diffusion_models/ideogram4_unconditional_fp8_scaled.safetensors diffusion_models
https://huggingface.co/Comfy-Org/Qwen-Image-Edit_ComfyUI/resolve/main/split_files/diffusion_models/qwen_image_edit_2509_fp8_e4m3fn.safetensors diffusion_models
https://huggingface.co/Comfy-Org/Qwen-Image-Edit_ComfyUI/resolve/main/split_files/diffusion_models/qwen_image_edit_2511_fp8mixed.safetensors diffusion_models
https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/diffusion_models/qwen_image_2512_fp8_e4m3fn.safetensors diffusion_models
https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/diffusion_models/wan2.1_i2v_480p_14B_fp8_e4m3fn.safetensors diffusion_models
https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/diffusion_models/wan2.1_t2v_14B_fp8_e4m3fn.safetensors diffusion_models
https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/diffusion_models/wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors diffusion_models
https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/diffusion_models/wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors diffusion_models
https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/diffusion_models/wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors diffusion_models
https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/diffusion_models/wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors diffusion_models
https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/diffusion_models/wan2.2_ti2v_5B_fp16.safetensors diffusion_models
https://huggingface.co/Comfy-Org/ace_step_1.5_ComfyUI_files/resolve/main/split_files/diffusion_models/acestep_v1.5_turbo.safetensors diffusion_models
https://huggingface.co/Kijai/HunyuanVideo_comfy/resolve/main/FramePackI2V_HY_fp8_e4m3fn.safetensors diffusion_models
https://huggingface.co/Kijai/LTX2.3_comfy/resolve/main/diffusion_models/ltx-2.3-22b-dev_transformer_only_fp8_scaled.safetensors diffusion_models
https://huggingface.co/Kijai/LTX2.3_comfy/resolve/main/diffusion_models/ltx-2.3-22b-distilled-1.1_transformer_only_fp8_scaled.safetensors diffusion_models
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/FantasyPortrait/Wan2_1_FantasyPortrait_fp16.safetensors diffusion_models
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/FlashVSR/Wan2_1-T2V-1_3B_FlashVSR_fp32.safetensors diffusion_models
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/FlashVSR/Wan2_1_FlashVSR_LQ_proj_model_bf16.safetensors diffusion_models
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/Fun/Wan2.1-Fun-InP-14B_fp8_e4m3fn.safetensors diffusion_models
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/InfiniteTalk/Wan2_1-InfiniTetalk-Single_fp16.safetensors diffusion_models
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/InfiniteTalk/Wan2_1-InfiniteTalk-Multi_fp16.safetensors diffusion_models
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/Lynx/Wan2_1-T2V-14B-Lynx_full_ip_layers_fp16.safetensors diffusion_models
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/Lynx/Wan2_1-T2V-14B-Lynx_full_ref_layers_fp16.safetensors diffusion_models
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/Lynx/lynx_full_resampler_fp32.safetensors diffusion_models
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/WanVideo_2_1_Multitalk_14B_fp8_e4m3fn.safetensors diffusion_models
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/fantasytalking_fp16.safetensors diffusion_models
https://huggingface.co/Kijai/WanVideo_comfy_fp8_scaled/resolve/main/Bindweave/Wan2_1-I2V-14B-Bindweave_fp8_scaled_KJ.safetensors diffusion_models
https://huggingface.co/Kijai/WanVideo_comfy_fp8_scaled/resolve/main/MoCha/Wan2_1_mocha-14B-preview_fp8_e4m3fn_scaled_KJ.safetensors diffusion_models
https://huggingface.co/Kijai/WanVideo_comfy_fp8_scaled/resolve/main/SCAIL/Wan21-14B-SCAIL-preview_fp8_e4m3fn_scaled_KJ.safetensors diffusion_models
https://huggingface.co/Kijai/WanVideo_comfy_fp8_scaled/resolve/main/VACE/Wan2_2_Fun_VACE_module_A14B_HIGH_fp8_e5m2_scaled_KJ.safetensors diffusion_models
https://huggingface.co/Kijai/WanVideo_comfy_fp8_scaled/resolve/main/VACE/Wan2_2_Fun_VACE_module_A14B_LOW_fp8_e5m2_scaled_KJ.safetensors diffusion_models
https://huggingface.co/Kijai/WanVideo_comfy_fp8_scaled/resolve/main/Wan22Animate/Wan2_2-Animate-14B_fp8_e4m3fn_scaled_KJ.safetensors diffusion_models
https://huggingface.co/ND911/HiDream_e1_full_bf16-ggufs/resolve/main/hidream_e1_full_bf16-Q4_0.gguf diffusion_models
https://huggingface.co/SulphurAI/Sulphur-2-base/resolve/main/sulphur_dev_fp8mixed.safetensors diffusion_models ltx-sulphur_dev_fp8mixed.safetensors
https://huggingface.co/circlestone-labs/Anima/resolve/main/split_files/diffusion_models/anima-preview3-base.safetensors diffusion_models
https://huggingface.co/comfyuistudio/nsfwKLein/resolve/main/nsfwKlein.safetensors diffusion_models
https://huggingface.co/comfyuistudio/wan22nsfw/resolve/main/WAN22-NSFW-I2V-HIGH.safetensors diffusion_models
https://huggingface.co/comfyuistudio/wan22nsfw/resolve/main/WAN22-NSFW-I2V-LOW.safetensors diffusion_models
https://huggingface.co/lllyasviel/ic-light/resolve/main/iclight_sd15_fc.safetensors diffusion_models
https://huggingface.co/louisnguyen198x/SmoothMixWan2.2/resolve/main/smoothMixWan22I2VT2V_i2vHigh.safetensors diffusion_models
https://huggingface.co/louisnguyen198x/SmoothMixWan2.2/resolve/main/smoothMixWan22I2VT2V_i2vLow.safetensors diffusion_models
https://huggingface.co/louisnguyen198x/SmoothMixWan2.2/resolve/main/smoothMixWan22I2VT2V_t2vHighV20.safetensors diffusion_models
https://huggingface.co/louisnguyen198x/SmoothMixWan2.2/resolve/main/smoothMixWan22I2VT2V_t2vLowV20.safetensors diffusion_models
https://huggingface.co/vrgamedevgirl84/Wan14BT2VFusioniX/resolve/main/Wan14Bi2vFusioniX.safetensors diffusion_models
https://huggingface.co/wikeeyang/SRPO-for-ComfyUI/resolve/main/SRPO-fp8_e4m3fn.safetensors diffusion_models
https://huggingface.co/Comfy-Org/z_image_turbo/resolve/main/split_files/diffusion_models/z_image_turbo_bf16.safetensors unet
https://huggingface.co/KwaiVGI/ReCamMaster-Wan2.1/resolve/main/step20000.ckpt unet recam-master-step20000-wan.ckpt
https://huggingface.co/MCG-NJU/SteadyDancer-GGUF/resolve/main/Wan21_I2V_SteadyDancer_fp16-Q6_K_fix_5d_tensor_from_fp8_e4m3fn_scaled_KJ.gguf unet
https://huggingface.co/QuantStack/Qwen-Image-Edit-GGUF/resolve/main/Qwen_Image_Edit-Q6_K.gguf unet
https://huggingface.co/QuantStack/Wan2.1_14B_VACE-GGUF/resolve/main/Wan2.1_14B_VACE-Q6_K.gguf unet
https://huggingface.co/city96/Qwen-Image-gguf/resolve/main/qwen-image-Q8_0.gguf unet
https://huggingface.co/comfyuistudio/qwreal/resolve/main/qwreal.safetensors unet
https://huggingface.co/jackzheng/flux-fill-FP8/resolve/main/fluxFillFP8_v10.safetensors unet
https://huggingface.co/jingheya/lotus-depth-g-v2-0-disparity/resolve/main/unet/diffusion_pytorch_model.safetensors unet lotus-depth-g-v2-0-disparity.safetensors
https://huggingface.co/lllyasviel/FLUX.1-schnell-gguf/resolve/main/flux1-schnell-Q4_0.gguf unet
https://huggingface.co/lllyasviel/flux1_dev/resolve/main/flux1-dev-fp8.safetensors unet
https://huggingface.co/realrebelai/SCAIL-2_GGUF/resolve/main/SCAIL-2-Q4_K_M.gguf unet

# ==========================================
# LORAS
# ==========================================
https://huggingface.co/Alissonerdx/LTX-LoRAs/resolve/main/ltx23_edit_anything_global_rank128_v1_9000steps_adamw.safetensors loras
https://huggingface.co/Alissonerdx/flux.1-dev-SRPO-LoRas/resolve/main/srpo_32_base_RockerBOO_model_fp16.safetensors loras
https://huggingface.co/ByteDance/Hyper-SD/resolve/main/Hyper-FLUX.1-dev-8steps-lora.safetensors loras
https://huggingface.co/DiffSynth-Studio/Qwen-Image-Edit-F2P/resolve/main/edit_0928_lora_step40000.safetensors loras Qwen-Image-Edit-F2P.safetensors
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/FastWan/FastWan_T2V_14B_480p_lora_rank_128_bf16.safetensors loras
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/Lightx2v/lightx2v_I2V_14B_480p_cfg_step_distill_rank256_bf16.safetensors loras
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/Lightx2v/lightx2v_I2V_14B_480p_cfg_step_distill_rank32_bf16.safetensors loras
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/Lightx2v/lightx2v_I2V_14B_480p_cfg_step_distill_rank64_bf16.safetensors loras
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/Lightx2v/lightx2v_T2V_14B_cfg_step_distill_v2_lora_rank32_bf16.safetensors loras
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/LoRAs/Stable-Video-Infinity/v2.0/SVI_v2_PRO_Wan2.2-I2V-A14B_HIGH_lora_rank_128_fp16.safetensors loras
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/LoRAs/Stable-Video-Infinity/v2.0/SVI_v2_PRO_Wan2.2-I2V-A14B_LOW_lora_rank_128_fp16.safetensors loras
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/LoRAs/Wan22_relight/WanAnimate_relight_lora_fp16.safetensors loras
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/Pusa/Wan21_PusaV1_LoRA_14B_rank512_bf16.safetensors loras
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/Wan21_AccVid_I2V_480P_14B_lora_rank32_fp16.safetensors loras
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/Wan21_T2V_14B_MoviiGen_lora_rank32_fp16.safetensors loras
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/Wan21_T2V_14B_lightx2v_cfg_step_distill_lora_rank32.safetensors loras
https://huggingface.co/Lightricks/LTX-2-19b-IC-LoRA-Detailer/resolve/main/ltx-2-19b-ic-lora-detailer.safetensors loras
https://huggingface.co/Lightricks/LTX-2.3-22b-IC-LoRA-Union-Control/resolve/main/ltx-2.3-22b-ic-lora-union-control-ref0.5.safetensors loras
https://huggingface.co/Lightricks/LTX-2.3/resolve/main/ltx-2.3-22b-distilled-lora-384.safetensors loras
https://huggingface.co/Lightricks/LTX-2/resolve/main/ltx-2-19b-distilled-lora-384.safetensors loras
https://huggingface.co/Remade-AI/Assassin/resolve/main/assassin_45_epochs.safetensors loras
https://huggingface.co/Remade-AI/Baby/resolve/main/baby_50_epochs.safetensors loras
https://huggingface.co/Remade-AI/Bride/resolve/main/bride_50_epochs.safetensors loras
https://huggingface.co/Remade-AI/Cakeify/resolve/main/cakeify_16_epochs.safetensors loras
https://huggingface.co/Remade-AI/Crush/resolve/main/crush_20_epochs.safetensors loras
https://huggingface.co/Remade-AI/Deflate/resolve/main/deflate_20_epochs.safetensors loras
https://huggingface.co/Remade-AI/Gun-Shooting/resolve/main/gun_20_epochs.safetensors loras
https://huggingface.co/Remade-AI/Inflate/resolve/main/inflate_20_epochs.safetensors loras
https://huggingface.co/Remade-AI/Jungle/resolve/main/jungle_50_epochs.safetensors loras
https://huggingface.co/Remade-AI/Mona-Lisa/resolve/main/mona_lisa_45_epochs.safetensors loras
https://huggingface.co/Remade-AI/Muscle/resolve/main/muscle_18_epochs.safetensors loras
https://huggingface.co/Remade-AI/Pirate-Captain/resolve/main/pirate_captain_50_epochs.safetensors loras
https://huggingface.co/Remade-AI/Princess/resolve/main/princess_45_epochs.safetensors loras
https://huggingface.co/Remade-AI/Puppy/resolve/main/puppy_50_epochs.safetensors loras
https://huggingface.co/Remade-AI/Rotate/resolve/main/rotate_20_epochs.safetensors loras
https://huggingface.co/Remade-AI/Samurai/resolve/main/samurai_50_epochs.safetensors loras
https://huggingface.co/Remade-AI/Squish/resolve/main/squish_18.safetensors loras
https://huggingface.co/Remade-AI/VIP/resolve/main/vip_50_epochs.safetensors loras
https://huggingface.co/Remade-AI/Warrior/resolve/main/warrior_45_epochs.safetensors loras
https://huggingface.co/Remade-AI/Zen/resolve/main/zen_50_epochs.safetensors loras
https://huggingface.co/ali-vilab/ACE_Plus/resolve/main/local_editing/comfyui_local_lora16.safetensors loras
https://huggingface.co/ali-vilab/ACE_Plus/resolve/main/portrait/comfyui_portrait_lora64.safetensors loras
https://huggingface.co/ali-vilab/ACE_Plus/resolve/main/subject/comfyui_subject_lora16.safetensors loras
https://huggingface.co/alibaba-pai/Wan2.1-Fun-Reward-LoRAs/resolve/main/Wan2.1-Fun-14B-InP-MPS.safetensors loras
https://huggingface.co/comfyuistudio/flx-cl-remover/resolve/main/flx-cl-remover.safetensors loras
https://huggingface.co/comfyuistudio/orins/resolve/main/CumShot-High.safetensors loras
https://huggingface.co/comfyuistudio/orins/resolve/main/CumShot-Low.safetensors loras
https://huggingface.co/comfyuistudio/orins/resolve/main/Oral-Ins-High.safetensors loras
https://huggingface.co/comfyuistudio/orins/resolve/main/Oral-Ins-Low.safetensors loras
https://huggingface.co/comfyuistudio/qwen-depthmap/resolve/main/qwen-depthmap-lora.safetensors loras
https://huggingface.co/comfyuistudio/sdxl-pony-loras/resolve/main/BreastSliderPony_alpha1.0_rank4_noxattn_last.safetensors loras
https://huggingface.co/comfyuistudio/sdxl-pony-loras/resolve/main/ILXL_Realism_Slider_V.1.safetensors loras
https://huggingface.co/comfyuistudio/sdxl-pony-loras/resolve/main/RealSkin_xxXL_v1.safetensors loras
https://huggingface.co/comfyuistudio/sdxl-pony-loras/resolve/main/Shy__Nervous__Scared.safetensors loras
https://huggingface.co/comfyuistudio/sdxl-pony-loras/resolve/main/ThiccPonyXL_V1.safetensors loras
https://huggingface.co/comfyuistudio/sdxl-pony-loras/resolve/main/add-detail-xl.safetensors loras
https://huggingface.co/comfyuistudio/sdxl-pony-loras/resolve/main/venus_body_PONY_v2.safetensors loras
https://huggingface.co/comfyuistudio/wan2.1_loras/resolve/main/SECRET_SAUCE_WAN2.1_14B_fp8.safetensors loras
https://huggingface.co/comfyuistudio/wan2.1_loras/resolve/main/detailz-wan.safetensors loras
https://huggingface.co/comfyuistudio/wan2.1_loras/resolve/main/dgyHairPull_WAN_run2-000350_converted.safetensors loras
https://huggingface.co/comfyuistudio/wan2.1_loras/resolve/main/dicks_epoch_100.safetensors loras
https://huggingface.co/comfyuistudio/wan2.1_loras/resolve/main/doggy_diffusers.safetensors loras
https://huggingface.co/comfyuistudio/wan2.1_loras/resolve/main/front_doggy_plow_v1_1_wan.safetensors loras
https://huggingface.co/comfyuistudio/wan2.1_loras/resolve/main/wan-nsfw-e14-fixed.safetensors loras
https://huggingface.co/comfyuistudio/wan2.2_xxx-loras/resolve/main/Fingering-I2V.safetensors loras
https://huggingface.co/comfyuistudio/wan2.2_xxx-loras/resolve/main/Fingering-T2V.safetensors loras
https://huggingface.co/comfyuistudio/wan2.2_xxx-loras/resolve/main/KISSHIGH.safetensors loras
https://huggingface.co/comfyuistudio/wan2.2_xxx-loras/resolve/main/KISSLOW.safetensors loras
https://huggingface.co/comfyuistudio/wan2.2_xxx-loras/resolve/main/PussyLoRA_HighNoise_Wan2.2_HearmemanAI.safetensors loras
https://huggingface.co/comfyuistudio/wan2.2_xxx-loras/resolve/main/PussyLoRA_LowNoise_Wan2.2_HearmemanAI.safetensors loras
https://huggingface.co/comfyuistudio/wan2.2_xxx-loras/resolve/main/V3TWERKHIGH.safetensors loras
https://huggingface.co/comfyuistudio/wan2.2_xxx-loras/resolve/main/V3TWERKLOW.safetensors loras
https://huggingface.co/comfyuistudio/wan2.2_xxx-loras/resolve/main/Wan2.2_Double-Penetration-High.safetensors loras
https://huggingface.co/comfyuistudio/wan2.2_xxx-loras/resolve/main/Wan2.2_Double-Penetration-Low.safetensors loras
https://huggingface.co/comfyuistudio/wan2.2_xxx-loras/resolve/main/Wan22-T2V-DildoRide-HIGH.safetensors loras
https://huggingface.co/comfyuistudio/wan2.2_xxx-loras/resolve/main/Wan22-T2V-DildoRide-LOW.safetensors loras
https://huggingface.co/comfyuistudio/wan2.2_xxx-loras/resolve/main/Wan22-T2V-DoggyStyle-HIGH.safetensors loras
https://huggingface.co/comfyuistudio/wan2.2_xxx-loras/resolve/main/Wan22-T2V-DoggyStyle-LOW.safetensors loras
https://huggingface.co/comfyuistudio/wan2.2_xxx-loras/resolve/main/mql_casting_sex_doggy_kneel_diagonally_behind_vagina_wan22_i2v_v1_high_noise.safetensors loras
https://huggingface.co/comfyuistudio/wan2.2_xxx-loras/resolve/main/mql_casting_sex_doggy_kneel_diagonally_behind_vagina_wan22_i2v_v1_low_noise.safetensors loras
https://huggingface.co/comfyuistudio/wan2.2_xxx-loras/resolve/main/mql_casting_sex_reverse_cowgirl_lie_front_vagina_wan22_i2v_v1_high_noise.safetensors loras
https://huggingface.co/comfyuistudio/wan2.2_xxx-loras/resolve/main/mql_casting_sex_reverse_cowgirl_lie_front_vagina_wan22_i2v_v1_low_noise.safetensors loras
https://huggingface.co/comfyuistudio/wan2.2_xxx-loras/resolve/main/mql_wink_wan22_i2v_v1_high_noise.safetensors loras
https://huggingface.co/comfyuistudio/wan2.2_xxx-loras/resolve/main/mql_wink_wan22_i2v_v1_low_noise.safetensors loras
https://huggingface.co/comfyuistudio/wan2.2_xxx-loras/resolve/main/wan2.2_i2v_highnoise_pov_missionary_v1.0.safetensors loras
https://huggingface.co/comfyuistudio/wan2.2_xxx-loras/resolve/main/wan2.2_i2v_lownoise_pov_missionary_v1.0.safetensors loras
https://huggingface.co/comfyuistudio/wan2.2_xxx-loras/resolve/main/wan2.2_t2v_highnoise_pov_missionary_v1.0.safetensors loras
https://huggingface.co/comfyuistudio/wan2.2_xxx-loras/resolve/main/wan2.2_t2v_lownoise_pov_missionary_v1.0.safetensors loras
https://huggingface.co/comfyuistudio/wan2.2_xxx-loras/resolve/main/wan_dildo_closeup_i2vA14B_HIGHNOISE_v20.safetensors loras
https://huggingface.co/comfyuistudio/wan2.2_xxx-loras/resolve/main/wan_dildo_closeup_i2vA14B_LOWNOISE_v20.safetensors loras
https://huggingface.co/comfyuistudio/wan2.2_xxx-loras/resolve/main/wan_dildo_fullbody_i2vA14B_HIGHNOISE_v20.safetensors loras
https://huggingface.co/comfyuistudio/wan2.2_xxx-loras/resolve/main/wan_dildo_fullbody_i2vA14B_LOWNOISE_v20.safetensors loras
https://huggingface.co/comfyuistudio/zit-depthmap/resolve/main/d3pth4-zit.safetensors loras
https://huggingface.co/dooszypehnees/consistence_edit_v2/resolve/main/consistence_edit_v2.safetensors loras
https://huggingface.co/fal/Qwen-Image-Edit-2511-Multiple-Angles-LoRA/resolve/main/qwen-image-edit-2511-multiple-angles-lora.safetensors loras
https://huggingface.co/lightx2v/Qwen-Image-Edit-2511-Lightning/resolve/main/Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors loras
https://huggingface.co/lightx2v/Qwen-Image-Edit-2511-Lightning/resolve/main/Qwen-Image-Edit-2511-Lightning-8steps-V1.0-fp32.safetensors loras
https://huggingface.co/lightx2v/Qwen-Image-Lightning/resolve/main/Qwen-Image-Lightning-4steps-V1.0.safetensors loras
https://huggingface.co/lightx2v/Wan2.1-I2V-14B-480P-StepDistill-CfgDistill-Lightx2v/resolve/main/loras/Wan21_I2V_14B_lightx2v_cfg_step_distill_lora_rank64.safetensors loras
https://huggingface.co/lightx2v/Wan2.2-Lightning/resolve/main/Wan2.2-I2V-A14B-4steps-lora-rank64-Seko-V1/high_noise_model.safetensors loras Wan2.2-I2V-HIGH-4steps-lora-rank64-Seko-V1.safetensors
https://huggingface.co/lightx2v/Wan2.2-Lightning/resolve/main/Wan2.2-I2V-A14B-4steps-lora-rank64-Seko-V1/low_noise_model.safetensors loras Wan2.2-I2V-LOW-4steps-lora-rank64-Seko-V1.safetensors
https://huggingface.co/lightx2v/Wan2.2-Lightning/resolve/main/Wan2.2-T2V-A14B-4steps-lora-rank64-Seko-V2.0/high_noise_model.safetensors loras Wan2.2-T2V-4steps-HIGH-rank64-Seko-V2.0.safetensors
https://huggingface.co/lightx2v/Wan2.2-Lightning/resolve/main/Wan2.2-T2V-A14B-4steps-lora-rank64-Seko-V2.0/low_noise_model.safetensors loras Wan2.2-T2V-4steps-LOW-rank64-Seko-V2.0.safetensors
https://huggingface.co/oumoumad/LTX-2.3-22b-IC-LoRA-Outpaint/resolve/main/ltx-2.3-22b-ic-lora-outpaint.safetensors loras
https://huggingface.co/systms/ACTION/resolve/main/QWEN_EDIT_ACTION_V1.safetensors loras
https://huggingface.co/valiantcat/LTX-2.3-Transition-LORA/resolve/main/ltx2.3-transition.safetensors loras
https://huggingface.co/vrgamedevgirl84/Wan14BT2VFusioniX/resolve/main/FusionX_LoRa/Wan2.1_I2V_14B_FusionX_LoRA.safetensors loras
https://huggingface.co/vrgamedevgirl84/Wan14BT2VFusioniX/resolve/main/FusionX_LoRa/Wan2.1_T2V_14B_FusionX_LoRA.safetensors loras
https://huggingface.co/vrgamedevgirl84/Wan14BT2VFusioniX/resolve/main/OtherLoRa's/DetailEnhancerV1.safetensors loras
https://huggingface.co/vrgamedevgirl84/Wan14BT2VFusioniX/resolve/main/OtherLoRa's/Wan14B_RealismBoost.safetensors loras
https://huggingface.co/wangfuyun/AnimateLCM/resolve/main/AnimateLCM_sd15_t2v_lora.safetensors loras
https://huggingface.co/xiaozaa/catvton-flux-lora-alpha/resolve/main/pytorch_lora_weights.safetensors loras catVtonLora.safetensors
https://huggingface.co/Alissonerdx/flux.1-dev-SRPO-LoRas/resolve/main/srpo_32_base_RockerBOO_model_fp16.safetensors loras/FLUX
https://huggingface.co/ByteDance/Hyper-SD/resolve/main/Hyper-FLUX.1-dev-8steps-lora.safetensors loras/FLUX
https://huggingface.co/ByteDance/Hyper-SD/resolve/main/Hyper-FLUX.1-dev-8steps-lora.safetensors loras/FLUX/HYPERFLUX
https://huggingface.co/comfyuistudio/qwen-loras/resolve/main/consistence_edit_v1.safetensors loras/qwen
https://huggingface.co/lightx2v/Qwen-Image-Lightning/resolve/main/Qwen-Image-Lightning-4steps-V1.0.safetensors loras/qwen
https://modelscope.cn/models/DiffSynth-Studio/Qwen-Image-Edit-F2P/resolve/v1/model.safetensors loras/qwen Qwen-Image-Edit-F2P.safetensors
https://huggingface.co/Kijai/WanVideo_comfy/resolve/ffc8175b07b79f430a1495d086e39e83d59729e0/Wan22_FunReward/Wan2.2-Fun-A14B-InP-LOW-HPS2.1_resized_dynamic_avg_rank_15_bf16.safetensors loras/wan
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/Lightx2v/lightx2v_I2V_14B_480p_cfg_step_distill_rank64_bf16.safetensors loras/wan
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/Lightx2v/lightx2v_T2V_14B_cfg_step_distill_v2_lora_rank256_bf16.safetensors loras/wan
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/Lightx2v/lightx2v_T2V_14B_cfg_step_distill_v2_lora_rank32_bf16.safetensors loras/wan
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/Lightx2v/lightx2v_T2V_14B_cfg_step_distill_v2_lora_rank64_bf16.safetensors loras/wan
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/LoRAs/Wan22_FunReward/Wan2.2-Fun-A14B-InP-HIGH-HPS2.1_resized_dynamic_avg_rank_14_bf16.safetensors loras/wan
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/Wan21_CausVid_14B_T2V_lora_rank32.safetensors loras/wan
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/Wan21_T2V_14B_MoviiGen_lora_rank32_fp16.safetensors loras/wan
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/Wan21_T2V_14B_lightx2v_cfg_step_distill_lora_rank32.safetensors loras/wan
https://huggingface.co/alibaba-pai/Wan2.1-Fun-Reward-LoRAs/resolve/main/Wan2.1-Fun-14B-InP-MPS.safetensors loras/wan
https://huggingface.co/comfyuistudio/wan2.1_loras/resolve/main/SECRET_SAUCE_WAN2.1_14B_fp8.safetensors loras/wan
https://huggingface.co/htdong/Wan-Alpha_ComfyUI/resolve/main/epoch-13-1500_changed.safetensors loras/wan
https://huggingface.co/vrgamedevgirl84/Wan14BT2VFusioniX/resolve/main/FusionX_LoRa/Wan2.1_I2V_14B_FusionX_LoRA.safetensors loras/wan
https://huggingface.co/vrgamedevgirl84/Wan14BT2VFusioniX/resolve/main/FusionX_LoRa/Wan2.1_T2V_14B_FusionX_LoRA.safetensors loras/wan
https://huggingface.co/vrgamedevgirl84/Wan14BT2VFusioniX/resolve/main/OtherLoRa's/DetailEnhancerV1.safetensors loras/wan
https://huggingface.co/vrgamedevgirl84/Wan14BT2VFusioniX/resolve/main/OtherLoRa's/Wan14B_RealismBoost.safetensors loras/wan
https://huggingface.co/comfyuistudio/wan2.1_loras/resolve/main/SECRET_SAUCE_WAN2.1_14B_fp8.safetensors loras/xxx/wan
https://huggingface.co/comfyuistudio/wan2.2_xxx-loras/resolve/main/BouncyWalkV01.safetensors loras/xxx/wan
https://huggingface.co/comfyuistudio/wan2.2_xxx-loras/resolve/main/SU_Twrk_EP62.safetensors loras/xxx/wan
https://huggingface.co/comfyuistudio/wan2.2_xxx-loras/resolve/main/bounce_i2v_v2_fixed.safetensors loras/xxx/wan

# ==========================================
# VAES
# ==========================================
https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/vae/wan_2.1_vae.safetensors models/vae/wan_2.1_vae.safetensors vae
https://huggingface.co/Comfy-Org/ERNIE-Image/resolve/main/vae/flux2-vae.safetensors vae
https://huggingface.co/Comfy-Org/HiDream-I1_ComfyUI/resolve/main/split_files/vae/ae.safetensors vae hidream-vae.safetensors
https://huggingface.co/Comfy-Org/HunyuanVideo_repackaged/resolve/main/split_files/vae/hunyuan_video_vae_bf16.safetensors vae
https://huggingface.co/Comfy-Org/Ideogram-4/resolve/main/vae/flux2-vae.safetensors vae
https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/vae/qwen_image_vae.safetensors vae
https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/vae/wan_2.1_vae.safetensors vae
https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/vae/wan2.2_vae.safetensors vae
https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/vae/wan_2.1_vae.safetensors vae
https://huggingface.co/Comfy-Org/ace_step_1.5_ComfyUI_files/resolve/main/split_files/vae/ace_1.5_vae.safetensors vae
https://huggingface.co/Comfy-Org/flux2-dev/resolve/main/split_files/vae/flux2-vae.safetensors vae
https://huggingface.co/Comfy-Org/z_image_turbo/resolve/main/split_files/vae/ae.safetensors vae z-image-vae.safetensors
https://huggingface.co/Kijai/LTX2.3_comfy/resolve/main/vae/LTX23_audio_vae_bf16.safetensors vae
https://huggingface.co/Kijai/LTX2.3_comfy/resolve/main/vae/LTX23_video_vae_bf16.safetensors vae
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/FlashVSR/Wan2_1_FlashVSR_TCDecoder_fp32.safetensors vae
https://huggingface.co/StableDiffusionVN/Flux/resolve/main/Vae/flux_vae.safetensors vae
https://huggingface.co/StableDiffusionVN/Flux/resolve/main/Vae/flux_vae.safetensors vae ae.safetensors
https://huggingface.co/circlestone-labs/Anima/resolve/main/split_files/vae/qwen_image_vae.safetensors vae
https://huggingface.co/htdong/Wan-Alpha_ComfyUI/resolve/main/wan_alpha_2.1_vae_alpha_channel.safetensors.safetensors vae
https://huggingface.co/htdong/Wan-Alpha_ComfyUI/resolve/main/wan_alpha_2.1_vae_rgb_channel.safetensors.safetensors vae
https://huggingface.co/madebyollin/sdxl-vae-fp16-fix/resolve/main/sdxl.vae.safetensors vae
https://huggingface.co/stabilityai/sd-vae-ft-mse-original/resolve/main/vae-ft-mse-840000-ema-pruned.safetensors vae

# ==========================================
# TEXT ENCODERS & CLIPS
# ==========================================
https://huggingface.co/Comfy-Org/HiDream-I1_ComfyUI/resolve/main/split_files/text_encoders/clip_g_hidream.safetensors clip
https://huggingface.co/Comfy-Org/HiDream-I1_ComfyUI/resolve/main/split_files/text_encoders/clip_l_hidream.safetensors clip
https://huggingface.co/Comfy-Org/HiDream-I1_ComfyUI/resolve/main/split_files/text_encoders/llama_3.1_8b_instruct_fp8_scaled.safetensors clip
https://huggingface.co/Comfy-Org/HiDream-I1_ComfyUI/resolve/main/split_files/text_encoders/t5xxl_fp8_e4m3fn_scaled.safetensors clip
https://huggingface.co/Comfy-Org/HunyuanVideo_repackaged/resolve/main/split_files/text_encoders/clip_l.safetensors clip
https://huggingface.co/Comfy-Org/HunyuanVideo_repackaged/resolve/main/split_files/text_encoders/llava_llama3_fp8_scaled.safetensors clip
https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors clip
https://huggingface.co/Comfy-Org/flux2-dev/resolve/main/split_files/text_encoders/mistral_3_small_flux2_fp8.safetensors clip
https://huggingface.co/Comfy-Org/z_image_turbo/resolve/main/split_files/text_encoders/qwen_3_4b.safetensors clip
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/open-clip-xlm-roberta-large-vit-huge-14_visual_fp16.safetensors clip
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/umt5-xxl-enc-bf16.safetensors clip
https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/umt5-xxl-enc-fp8_e4m3fn.safetensors clip
https://huggingface.co/NSFW-API/NSFW-Wan-UMT5-XXL/resolve/main/nsfw_wan_umt5-xxl_fp8_scaled.safetensors clip
https://huggingface.co/circlestone-labs/Anima/resolve/main/split_files/text_encoders/qwen_3_06b_base.safetensors clip
https://huggingface.co/city96/umt5-xxl-encoder-gguf/resolve/main/umt5-xxl-encoder-Q3_K_S.gguf clip
https://huggingface.co/city96/umt5-xxl-encoder-gguf/resolve/main/umt5-xxl-encoder-Q4_K_M.gguf clip
https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors clip
https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors clip clip_l-for-gguf.safetensors
https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp8_e4m3fn.safetensors clip
https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/clip_vision/clip_vision_h.safetensors clip_vision
https://huggingface.co/Comfy-Org/sigclip_vision_384/resolve/main/sigclip_vision_patch14_384.safetensors clip_vision
https://huggingface.co/google/siglip-so400m-patch14-384/resolve/main/model.safetensors clip_vision sigclip-so400m-patch14-384.safetensors
https://huggingface.co/google/siglip-so400m-patch14-384/resolve/main/model.safetensors clip_vision sigclip-vision-patch14-384.safetensors
https://huggingface.co/Comfy-Org/ERNIE-Image/resolve/main/text_encoders/ministral-3-3b.safetensors text_encoders
https://huggingface.co/Comfy-Org/HunyuanVideo_1.5_repackaged/resolve/main/split_files/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors text_encoders
https://huggingface.co/Comfy-Org/Ideogram-4/resolve/main/text_encoders/qwen3vl_8b_fp8_scaled.safetensors text_encoders
https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors text_encoders
https://huggingface.co/Comfy-Org/ace_step_1.5_ComfyUI_files/resolve/main/split_files/text_encoders/qwen_0.6b_ace15.safetensors text_encoders
https://huggingface.co/Comfy-Org/ace_step_1.5_ComfyUI_files/resolve/main/split_files/text_encoders/qwen_1.7b_ace15.safetensors text_encoders
https://huggingface.co/Comfy-Org/flux2-klein-9B/resolve/main/split_files/text_encoders/qwen_3_8b_fp8mixed.safetensors text_encoders
https://huggingface.co/Comfy-Org/ltx-2/resolve/main/split_files/text_encoders/gemma_3_12B_it.safetensors text_encoders
https://huggingface.co/Comfy-Org/z_image_turbo/resolve/main/split_files/text_encoders/qwen_3_4b.safetensors text_encoders
https://huggingface.co/Kijai/LTX2.3_comfy/resolve/main/text_encoders/ltx-2.3_text_projection_bf16.safetensors text_encoders
https://huggingface.co/datasets/comfyuistudio/gemma/resolve/main/gemma_3_12B_it_fp4_mixed.safetensors text_encoders
https://huggingface.co/datasets/comfyuistudio/gm/resolve/main/added_tokens.json text_encoders/gemma-3-12b-it-bnb-4bit
https://huggingface.co/datasets/comfyuistudio/gm/resolve/main/chat_template.jinja text_encoders/gemma-3-12b-it-bnb-4bit
https://huggingface.co/datasets/comfyuistudio/gm/resolve/main/chat_template.json text_encoders/gemma-3-12b-it-bnb-4bit
https://huggingface.co/datasets/comfyuistudio/gm/resolve/main/config.json text_encoders/gemma-3-12b-it-bnb-4bit
https://huggingface.co/datasets/comfyuistudio/gm/resolve/main/generation_config.json text_encoders/gemma-3-12b-it-bnb-4bit
https://huggingface.co/datasets/comfyuistudio/gm/resolve/main/model-00001-of-00002.safetensors text_encoders/gemma-3-12b-it-bnb-4bit
https://huggingface.co/datasets/comfyuistudio/gm/resolve/main/model-00002-of-00002.safetensors text_encoders/gemma-3-12b-it-bnb-4bit
https://huggingface.co/datasets/comfyuistudio/gm/resolve/main/model.safetensors.index.json text_encoders/gemma-3-12b-it-bnb-4bit
https://huggingface.co/datasets/comfyuistudio/gm/resolve/main/preprocessor_config.json text_encoders/gemma-3-12b-it-bnb-4bit
https://huggingface.co/datasets/comfyuistudio/gm/resolve/main/processor_config.json text_encoders/gemma-3-12b-it-bnb-4bit
https://huggingface.co/datasets/comfyuistudio/gm/resolve/main/special_tokens_map.json text_encoders/gemma-3-12b-it-bnb-4bit
https://huggingface.co/datasets/comfyuistudio/gm/resolve/main/tokenizer.json text_encoders/gemma-3-12b-it-bnb-4bit
https://huggingface.co/datasets/comfyuistudio/gm/resolve/main/tokenizer.model text_encoders/gemma-3-12b-it-bnb-4bit
https://huggingface.co/datasets/comfyuistudio/gm/resolve/main/tokenizer_config.json text_encoders/gemma-3-12b-it-bnb-4bit

# ==========================================
# CONTROLNETS
# ==========================================
https://huggingface.co/Comfy-Org/Qwen-Image-InstantX-ControlNets/resolve/main/split_files/controlnet/Qwen-Image-InstantX-ControlNet-Union.safetensors controlnet
https://huggingface.co/InstantX/InstantID/resolve/main/ControlNetModel/diffusion_pytorch_model.safetensors controlnet
https://huggingface.co/Shakker-Labs/FLUX.1-dev-ControlNet-Union-Pro-2.0/resolve/main/diffusion_pytorch_model.safetensors controlnet FLUX.1-dev-ControlNet-Union-Pro-2.0.safetensors
https://huggingface.co/alimama-creative/FLUX.1-dev-Controlnet-Inpainting-Beta/resolve/main/diffusion_pytorch_model.safetensors controlnet FLUX.1-dev-Controlnet-Inpainting-Beta.safetensors
https://huggingface.co/jasperai/Flux.1-dev-Controlnet-Upscaler/resolve/main/diffusion_pytorch_model.safetensors controlnet
https://huggingface.co/lllyasviel/control_v11f1p_sd15_depth/resolve/main/diffusion_pytorch_model.fp16.safetensors controlnet control_v11f1p_sd15_depth.safetensors
https://huggingface.co/lllyasviel/control_v11p_sd15_openpose/resolve/main/diffusion_pytorch_model.safetensors controlnet control_v11p_sd15_openpose.safetensors
https://huggingface.co/monster-labs/control_v1p_sd15_qrcode_monster/resolve/main/control_v1p_sd15_qrcode_monster.safetensors controlnet
https://huggingface.co/monster-labs/control_v1p_sdxl_qrcode_monster/resolve/main/diffusion_pytorch_model.safetensors controlnet control_v1p_sdxl_qrcode_monster.safetensors
https://huggingface.co/vuongminhkhoi4/ComfyUI_InfiniteYou/resolve/main/aes_stage2_control_net/aes_stage2_control.safetensors controlnet
https://huggingface.co/vuongminhkhoi4/ComfyUI_InfiniteYou/resolve/main/sim_stage1_control_net/sim_stage1_control_net.safetensors controlnet
https://huggingface.co/xinsir/controlnet-union-sdxl-1.0/resolve/main/diffusion_pytorch_model_promax.safetensors controlnet controlnet-union-sdxl-1.0.safetensors

# ==========================================
# IP-ADAPTERS
# ==========================================
https://huggingface.co/InvokeAI/ip_adapter_plus_sd15/resolve/main/ip-adapter-plus_sd15.safetensors ipadapter
https://huggingface.co/h94/IP-Adapter/resolve/main/sdxl_models/ip-adapter-plus-face_sdxl_vit-h.safetensors ipadapter
https://huggingface.co/h94/IP-Adapter/resolve/main/sdxl_models/ip-adapter-plus_sdxl_vit-h.safetensors ipadapter
https://huggingface.co/h94/IP-Adapter/resolve/main/sdxl_models/ip-adapter_sdxl_vit-h.safetensors ipadapter

# ==========================================
# UPSCALERS
# ==========================================
https://huggingface.co/Lightricks/LTX-2/resolve/main/ltx-2-spatial-upscaler-x2-1.0.safetensors latent_upscale_models
https://huggingface.co/FacehugmanIII/4x_foolhardy_Remacri/resolve/main/4x_foolhardy_Remacri.pth upscale_models

# ==========================================
# FACE & OBJECT DETECTION
# ==========================================
https://huggingface.co/JunkyByte/easy_ViTPose/resolve/main/onnx/wholebody/vitpose-l-wholebody.onnx detection
https://huggingface.co/Wan-AI/Wan2.2-Animate-14B/resolve/main/process_checkpoint/det/yolov10m.onnx detection
https://huggingface.co/onnx-community/yolov10m/resolve/main/onnx/model.onnx detection yolov10m.onnx
https://huggingface.co/datasets/comfyuistudio/insf/resolve/main/insightface/inswapper_128.onnx insightface
https://huggingface.co/datasets/comfyuistudio/insf/resolve/main/insightface/inswapper_128_fp16.onnx insightface
https://huggingface.co/datasets/comfyuistudio/insf/resolve/main/insightface/models/antelopev2/1k3d68.onnx insightface/models/antelopev2
https://huggingface.co/datasets/comfyuistudio/insf/resolve/main/insightface/models/antelopev2/2d106det.onnx insightface/models/antelopev2
https://huggingface.co/datasets/comfyuistudio/insf/resolve/main/insightface/models/antelopev2/genderage.onnx insightface/models/antelopev2
https://huggingface.co/datasets/comfyuistudio/insf/resolve/main/insightface/models/antelopev2/glintr100.onnx insightface/models/antelopev2
https://huggingface.co/datasets/comfyuistudio/insf/resolve/main/insightface/models/antelopev2/scrfd_10g_bnkps.onnx insightface/models/antelopev2
https://huggingface.co/datasets/comfyuistudio/insf/resolve/main/insightface/models/buffalo_l/1k3d68.onnx insightface/models/buffalo_l
https://huggingface.co/datasets/comfyuistudio/insf/resolve/main/insightface/models/buffalo_l/2d106det.onnx insightface/models/buffalo_l
https://huggingface.co/datasets/comfyuistudio/insf/resolve/main/insightface/models/buffalo_l/det_10g.onnx insightface/models/buffalo_l
https://huggingface.co/datasets/comfyuistudio/insf/resolve/main/insightface/models/buffalo_l/genderage.onnx insightface/models/buffalo_l
https://huggingface.co/datasets/comfyuistudio/insf/resolve/main/insightface/models/buffalo_l/w600k_r50.onnx insightface/models/buffalo_l
https://huggingface.co/Bingsu/adetailer/resolve/main/face_yolov8m.pt ultralytics/bbox
https://huggingface.co/datasets/Gourieff/ReActor/resolve/main/models/detection/bbox/face_yolov8m.pt ultralytics/bbox
https://huggingface.co/outfly/face_yolov8m/resolve/main/face_yolov8m.pt ultralytics/bbox

# ==========================================
# ANIMATEDIFF_MODELS
# ==========================================
https://huggingface.co/wangfuyun/AnimateLCM/resolve/main/AnimateLCM_sd15_t2v.ckpt animatediff_models

# ==========================================
# DRAMABOX
# ==========================================
https://huggingface.co/ResembleAI/Dramabox/resolve/main/dramabox-audio-components.safetensors DramaBox
https://huggingface.co/ResembleAI/Dramabox/resolve/main/dramabox-dit-v1.safetensors DramaBox

# ==========================================
# INFINITEYOU
# ==========================================
https://huggingface.co/vuongminhkhoi4/ComfyUI_InfiniteYou/resolve/main/aes_stage2_control_net/aes_stage2_img_proj.bin InfiniteYou
https://huggingface.co/vuongminhkhoi4/ComfyUI_InfiniteYou/resolve/main/sim_stage1_control_net/sim_stage1_img_proj.bin InfiniteYou

# ==========================================
# INPAINT
# ==========================================
https://huggingface.co/lllyasviel/fooocus_inpaint/resolve/8fcfd208b8e76537f23ae061dc3e3d26714ee4ec/inpaint_v26.fooocus.patch inpaint
https://huggingface.co/lllyasviel/fooocus_inpaint/resolve/main/fooocus_inpaint_head.pth inpaint
https://huggingface.co/lllyasviel/fooocus_inpaint/resolve/main/inpaint_v26.fooocus.patch inpaint

# ==========================================
# INSTANTID
# ==========================================
https://huggingface.co/InstantX/InstantID/resolve/main/ip-adapter.bin instantid

# ==========================================
# LLM_GGUF
# ==========================================
https://huggingface.co/MaziyarPanahi/Mistral-7B-Instruct-v0.3-GGUF/resolve/main/Mistral-7B-Instruct-v0.3.Q4_K_M.gguf llm_gguf

# ==========================================
# MMAUDIO
# ==========================================
https://huggingface.co/Kijai/MMAudio_safetensors/resolve/main/apple_DFN5B-CLIP-ViT-H-14-384_fp16.safetensors mmaudio
https://huggingface.co/Kijai/MMAudio_safetensors/resolve/main/mmaudio_large_44k_v2_fp16.safetensors mmaudio
https://huggingface.co/Kijai/MMAudio_safetensors/resolve/main/mmaudio_synchformer_fp16.safetensors mmaudio
https://huggingface.co/Kijai/MMAudio_safetensors/resolve/main/mmaudio_vae_44k_fp16.safetensors mmaudio

# ==========================================
# MODEL_PATCHES
# ==========================================
https://huggingface.co/alibaba-pai/Z-Image-Turbo-Fun-Controlnet-Union/resolve/main/Z-Image-Turbo-Fun-Controlnet-Union.safetensors model_patches

# ==========================================
# ONNX
# ==========================================
https://huggingface.co/Metal3d/deeplabv3p-resnet50-human/resolve/main/deeplabv3p-resnet50-human.onnx onnx/human-parts

# ==========================================
# PHOTOMAKER
# ==========================================
https://huggingface.co/TencentARC/PhotoMaker-V2/resolve/main/photomaker-v2.bin photomaker

# ==========================================
# PULID
# ==========================================
https://huggingface.co/guozinan/PuLID/resolve/main/pulid_flux_v0.9.1.safetensors pulid
https://huggingface.co/huchenlei/ipadapter_pulid/resolve/main/ip-adapter_pulid_sdxl_fp16.safetensors?download=true pulid ip-adapter_pulid_sdxl_fp16.safetensors

# ==========================================
# SAMS
# ==========================================
https://huggingface.co/datasets/Gourieff/ReActor/resolve/main/models/sams/sam_vit_b_01ec64.pth sams

# ==========================================
# STYLE_MODELS
# ==========================================
https://huggingface.co/Comfy-Org/Flux1-Redux-Dev/resolve/main/flux1-redux-dev.safetensors style_models

# ==========================================
# WAN
# ==========================================
https://huggingface.co/alibaba-pai/Wan2.1-Fun-Reward-LoRAs/resolve/main/Wan2.1-Fun-14B-InP-MPS.safetensors wan
https://huggingface.co/alibaba-pai/Wan2.2-Fun-Reward-LoRAs/resolve/main/Wan2.2-Fun-A14B-InP-low-noise-HPS2.1.safetensors wan
https://huggingface.co/lightx2v/Wan2.2-Lightning/resolve/main/Wan2.2-T2V-A14B-4steps-lora-250928/low_noise_model.safetensors wan Wan2.2-T2V-A14B-4steps-lora-250928.safetensors
https://huggingface.co/vrgamedevgirl84/Wan14BT2VFusioniX/resolve/main/OtherLoRa's/Wan14B_RealismBoost.safetensors wan
"""

# 1. Update data/master-model-list.txt
TXT_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "master-model-list.txt")

header = "# ========================================================\n# SIMPLEPOD MASTER COMFYUI MODEL DOWNLOAD LIST\n# Updated via Verified ComfyUI Model Directory Mappings\n# ========================================================\n\n"

with open(TXT_PATH, "w", encoding="utf-8") as f:
    f.write(header + VERIFIED_LIST_TEXT.strip() + "\n")

print("Successfully updated master-model-list.txt with 165+ verified model links & directory mappings.")

# 2. Update workflowsData.json catalog & workflows models
JSON_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "src", "data", "workflowsData.json")

# Build mapping of clean_url -> { folder, custom_name }
url_map = {}
for line in VERIFIED_LIST_TEXT.strip().splitlines():
    line = line.strip()
    if not line or line.startswith("#"):
        continue
    parts = line.split(None, 2)
    if len(parts) >= 2 and parts[0].startswith("http"):
        url = parts[0].replace("civitai.red", "civitai.com").split("?")[0]
        folder = parts[1]
        custom_name = parts[2] if len(parts) > 2 else ""
        url_map[url] = { "folder": folder, "custom_name": custom_name }

if os.path.exists(JSON_PATH):
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        wf_data = json.load(f)

    updated_cat = 0
    updated_wf = 0

    for item in wf_data.get("catalog", []):
        u = item.get("url", "").split("?")[0]
        if u in url_map:
            info = url_map[u]
            item["folder"] = info["folder"]
            if info["custom_name"]:
                item["name"] = info["custom_name"]
            updated_cat += 1

    for wf in wf_data.get("workflows", []):
        for item in wf.get("models", []):
            u = item.get("url", "").split("?")[0]
            if u in url_map:
                info = url_map[u]
                item["folder"] = info["folder"]
                if info["custom_name"]:
                    item["name"] = info["custom_name"]
                updated_wf += 1

    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(wf_data, f, indent=2)

    print(f"Updated workflowsData.json: {updated_cat} catalog items and {updated_wf} workflow models matched.")

# 3. Update Supabase Database
password = os.getenv('SUPABASE_DB_PASSWORD', 'Mycomfyui!!@@751')

try:
    conn = psycopg2.connect(
        host=os.getenv('SUPABASE_DB_HOST', 'db.fgrmbmltnqinmtgzrbpi.supabase.co'),
        port=int(os.getenv('SUPABASE_DB_PORT', 5432)),
        dbname=os.getenv('SUPABASE_DB_NAME', 'postgres'),
        user=os.getenv('SUPABASE_DB_USER', 'postgres'),
        password=password,
        sslmode='require',
        connect_timeout=15
    )
    cur = conn.cursor()

    supa_updates = 0
    for u, info in url_map.items():
        cur.execute(
            "UPDATE public.model_cache SET folder = %s, name = COALESCE(NULLIF(%s, ''), name) WHERE clean_url LIKE %s;",
            (info["folder"], info["custom_name"], f"{u}%")
        )
        cur.execute(
            "UPDATE public.model_list SET folder = %s, name = COALESCE(NULLIF(%s, ''), name) WHERE url LIKE %s;",
            (info["folder"], info["custom_name"], f"{u}%")
        )
        supa_updates += cur.rowcount

    conn.commit()
    print(f"Database updated with {supa_updates} records matched from verified list.")
    cur.close()
    conn.close()
except Exception as e:
    print("Database sync error:", type(e).__name__, str(e))

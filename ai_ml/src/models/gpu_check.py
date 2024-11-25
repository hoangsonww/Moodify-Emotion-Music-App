import torch


def check_gpu():
    """
    Check if a GPU is available and print the GPU name.

    :return: None
    """
    cuda_available = torch.cuda.is_available()
    num_gpus = torch.cuda.device_count()
    if cuda_available and num_gpus > 0:
        gpu_name = torch.cuda.get_device_name(0)
        print(f"CUDA is available: {cuda_available}")
        print(f"Number of GPUs: {num_gpus}")
        print(f"GPU Name: {gpu_name}")
    else:
        print("No GPU detected or CUDA is not available.")


if __name__ == "__main__":
    check_gpu()

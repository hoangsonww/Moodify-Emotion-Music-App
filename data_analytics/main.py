import subprocess
import os
import sys


def run_script(script_name):
    """
    Helper function to run a Python script using the current virtual environment's Python executable.

    :param script_name: The name of the script to run.
    """
    try:
        # Use sys.executable to ensure the current Python interpreter (from the virtual environment) is used
        print(f"\nRunning {script_name}...")
        subprocess.run([sys.executable, script_name], check=True)
        print(f"{script_name} completed successfully.")
    except subprocess.CalledProcessError as e:
        print(f"Error occurred while running {script_name}: {e}")


def main():
    """
    Main function to run all analytics scripts.

    :return: None
    """
    # Define the list of scripts to run
    scripts_to_run = [
        "emotion_distribution.py",
        "training_visualization.py",
        "predictions_analysis.py",
        "recommendation_analysis.py"
    ]

    # Change directory to data_analytics
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    # Create the visualizations folder if it doesn't exist
    visualizations_folder = "visualizations"
    if not os.path.exists(visualizations_folder):
        os.makedirs(visualizations_folder)

    # Run each script in the list
    for script in scripts_to_run:
        run_script(script)

    print("\nAll analytics scripts have been executed.")


if __name__ == "__main__":
    main()

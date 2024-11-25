import os
from pyspark.sql import SparkSession

# Import Hadoop configurations
import hadoop_config

# Paths to the CSV files
TRAINING_DATA_PATH = os.path.abspath("ai_ml/data/training.csv")
TEST_DATA_PATH = os.path.abspath("ai_ml/data/test.csv")


def process_data_with_spark():
    """
    This function reads the training and test data using Spark, performs some simple transformations, and saves the
    transformed training data to a new location.

    :return: A dictionary containing the training and test data DataFrames.
    """
    # Initialize Spark Session
    spark = SparkSession.builder \
        .appName("EmotionBasedMusicApp") \
        .config("spark.master", "local") \
        .config("spark.hadoop.fs.defaultFS", "file:///") \
        .getOrCreate()

    # Read training data
    print("Reading training data from:", TRAINING_DATA_PATH)
    training_df = spark.read.csv(TRAINING_DATA_PATH, header=True, inferSchema=True)
    print("Training Data Schema:")
    training_df.printSchema()

    # Display some data
    print("Training Data Sample:")
    training_df.show(5)

    # Perform some simple data transformations
    training_df = training_df.withColumnRenamed("Emotion", "Label")
    training_df = training_df.dropna()  # Drop rows with missing values

    # Display transformed data
    print("Transformed Training Data Sample:")
    training_df.show(5)

    # Save the transformed data
    training_output_path = "ai_ml/data/transformed_training"
    training_df.write.mode("overwrite").csv(training_output_path, header=True)
    print(f"Transformed training data saved to {training_output_path}")

    # Read test data
    print("Reading test data from:", TEST_DATA_PATH)
    test_df = spark.read.csv(TEST_DATA_PATH, header=True, inferSchema=True)

    # Display some test data
    print("Test Data Sample:")
    test_df.show(5)

    # Stop the Spark session
    spark.stop()

    return {
        "training_data": training_df,
        "test_data": test_df
    }

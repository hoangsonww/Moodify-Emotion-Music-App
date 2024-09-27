import os

# Set up environment variables for Hadoop and Spark
os.environ["HADOOP_HOME"] = "C:/hadoop"  # Update with your Hadoop installation path
os.environ["SPARK_HOME"] = "C:/spark"    # Update with your Spark installation path
os.environ["HADOOP_CONF_DIR"] = "C:/hadoop/etc/hadoop"

# Append Hadoop and Spark binaries to the PATH
os.environ["PATH"] += os.pathsep + os.path.join(os.environ["HADOOP_HOME"], "bin")
os.environ["PATH"] += os.pathsep + os.path.join(os.environ["SPARK_HOME"], "bin")
